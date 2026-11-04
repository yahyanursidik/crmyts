import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db/client';
import { appUsers, appUserCredentials } from '../server/db/schema';
import { hashPassword } from '../server/auth/password';

// Run only against the selected development/staging database after migration 0012.
// Secrets are read from the environment and are never printed or put in arguments.
async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('INITIAL_ADMIN_EMAIL dan INITIAL_ADMIN_PASSWORD (minimal 12 karakter) wajib diisi.');
  const db = getDb();
  const user = await db.query.appUsers.findFirst({ where: eq(appUsers.email, email), with: { userRoles: { with: { role: true } } } });
  if (!user?.isActive || !user.userRoles.some((assignment) => assignment.role.code === 'crm_admin')) throw new Error('Akun administrator aktif dengan peran crm_admin tidak ditemukan.');
  const passwordHash = await hashPassword(password);
  await db.insert(appUserCredentials).values({ userId: user.id, passwordHash }).onConflictDoUpdate({ target: appUserCredentials.userId, set: { passwordHash, sessionVersion: sql`${appUserCredentials.sessionVersion} + 1`, updatedAt: new Date() } });
  console.log('Kredensial administrator tersimpan. Semua sesi lama akun ini diakhiri.');
}
main().then(() => process.exit(0)).catch(() => { console.error('Bootstrap gagal. Periksa variabel lingkungan, migrasi 0012, dan akun administrator.'); process.exit(1); });
