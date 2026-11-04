import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword, verifyPassword } from '../server/auth/password';
import { environmentArg, prepareEnvironment, readVault, vaultOperation, fingerprint, saveReport, targets, type AccessVault, type AccessAccount } from './access-runtime';

const required = [
  ['crm_admin', 'admin@tarbiyahsunnah.id', 'Administrator YTS'],
  ['finance_verifier', 'finance@tarbiyahsunnah.id', 'Verifikator Keuangan YTS'],
  ['cs_officer', 'cs@tarbiyahsunnah.id', 'Layanan Jamaah YTS'],
  ['event_admin', 'kajian@tarbiyahsunnah.id', 'Admin Event YTS'],
  ['fundraising_officer', 'fundraising@tarbiyahsunnah.id', 'Fundraising YTS'],
  ['waqf_officer', 'waqf@tarbiyahsunnah.id', 'Pengelola Wakaf YTS'],
  ['leadership_viewer', 'pimpinan@tarbiyahsunnah.id', 'Pimpinan YTS'],
  ['data_steward', 'data@tarbiyahsunnah.id', 'Pengelola Data YTS'],
  ['broadcast_officer', 'broadcast@tarbiyahsunnah.id', 'Komunikasi YTS'],
  ['auditor', 'auditor@tarbiyahsunnah.id', 'Auditor YTS'],
];

async function main() {
  const environment = environmentArg();
  let vault = readVault(environment);
  const pool = prepareEnvironment(environment);
  try {
    const before = await fingerprint(pool);
    const originalUsers = (await pool.query('SELECT * FROM public.app_users ORDER BY id')).rows;
    const originalAssignments = (await pool.query('SELECT * FROM public.user_roles ORDER BY user_id, role_id')).rows;
    const migration = readFileSync(resolve('drizzle/0012_staff_credentials.sql'), 'utf8');
    const migrationClient = await pool.connect();
    try { await migrationClient.query('BEGIN'); await migrationClient.query("SET LOCAL lock_timeout = '5s'"); await migrationClient.query(migration); await migrationClient.query('COMMIT'); }
    catch (error) { await migrationClient.query('ROLLBACK'); throw error; }
    finally { migrationClient.release(); }
    const afterMigration = await fingerprint(pool);
    if (JSON.stringify(before) !== JSON.stringify(afterMigration)) throw new Error('Isi tabel lama berubah selama migrasi; provisioning dihentikan.');
    const roleRows = (await pool.query('SELECT id, code FROM public.roles')).rows;
    if (!vault) {
      const accounts: AccessAccount[] = required.map(([role, email, fullName]) => {
        const existing = originalUsers.find((user) => user.email.toLowerCase() === email);
        if (existing && !existing.is_active) throw new Error(`Akun nonaktif tidak diaktifkan otomatis: ${email}`);
        return { id: existing?.id || randomUUID(), email, fullName: existing?.full_name || fullName, role, password: `Yts!${randomBytes(18).toString('base64url')}`, created: !existing };
      });
      vault = { environment, databaseHost: targets[environment].read_write_host, authSecret: randomBytes(48).toString('hex'), createdAt: new Date().toISOString(), accounts };
      vaultOperation('Protect', environment, vault);
    }
    if (vault.environment !== environment || vault.databaseHost !== targets[environment].read_write_host) throw new Error('Vault tidak sesuai dengan target database.');
    const connection = await pool.connect();
    let insertedUsers = 0, insertedCredentials = 0;
    try {
      await connection.query('BEGIN');
      for (const account of vault.accounts) {
        const role = roleRows.find((row) => row.code === account.role);
        if (!role) throw new Error(`Peran belum terdaftar: ${account.role}`);
        const existing = originalUsers.find((row) => row.id === account.id);
        if (!existing) {
          await connection.query('INSERT INTO public.app_users (id, email, full_name, auth_subject, is_active) VALUES ($1, $2, $3, $4, true)', [account.id, account.email, account.fullName, `usr_${account.role}_yts`]);
          await connection.query('INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2)', [account.id, role.id]);
          insertedUsers++;
        } else if (!originalAssignments.some((assignment) => assignment.user_id === account.id && assignment.role_id === role.id)) throw new Error(`Peran akun lama tidak cocok; tidak diubah otomatis: ${account.email}`);
        const credential = (await connection.query('SELECT password_hash FROM public.app_user_credentials WHERE user_id = $1', [account.id])).rows[0];
        if (credential) {
          if (!await verifyPassword(account.password, credential.password_hash)) throw new Error(`Kredensial yang sudah ada tidak akan ditimpa: ${account.email}`);
        } else {
          await connection.query('INSERT INTO public.app_user_credentials (user_id, password_hash) VALUES ($1, $2)', [account.id, await hashPassword(account.password)]);
          insertedCredentials++;
        }
      }
      const unchangedUsers = (await connection.query('SELECT * FROM public.app_users WHERE id = ANY($1::uuid[]) ORDER BY id', [originalUsers.map((user) => user.id)])).rows;
      const unchangedRoles = (await connection.query('SELECT * FROM public.user_roles WHERE user_id = ANY($1::uuid[]) ORDER BY user_id, role_id', [originalUsers.map((user) => user.id)])).rows;
      if (JSON.stringify(originalUsers) !== JSON.stringify(unchangedUsers) || JSON.stringify(originalAssignments) !== JSON.stringify(unchangedRoles)) throw new Error('Data akun lama tidak cocok; transaksi dibatalkan.');
      await connection.query('COMMIT');
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
    const protectedTables = targets.legacyTables.filter((name: string) => !['app_users', 'user_roles'].includes(name));
    const after = await fingerprint(pool, protectedTables);
    const old = before.filter((table) => protectedTables.includes(table.table_name));
    if (JSON.stringify(old) !== JSON.stringify(after)) throw new Error('Pemeriksaan tabel operasional tidak cocok.');
    const report = { environment, branchId: targets[environment].branchId, snapshotId: targets.snapshotId, migrationApplied: true, originalUsersPreserved: originalUsers.length, originalAssignmentsPreserved: originalAssignments.length, legacyTablesPreserved: protectedTables.length, newUsers: insertedUsers, newCredentials: insertedCredentials, totalRoleAccounts: vault.accounts.length, checkedAt: new Date().toISOString(), accounts: vault.accounts.map(({password, ...account}) => account), before, after };
    saveReport(`${environment}-provisioning.json`, report);
    console.log(JSON.stringify({ environment, migrationApplied: true, originalUsersPreserved: originalUsers.length, legacyTablesPreserved: protectedTables.length, newUsers: insertedUsers, totalRoleAccounts: vault.accounts.length, credentials: 'Tersimpan terenkripsi dengan Windows DPAPI' }));
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Provisioning gagal.'); process.exitCode = 1; });
