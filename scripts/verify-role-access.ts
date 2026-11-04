import { environmentArg, prepareEnvironment, readVault, saveReport, fingerprint } from './access-runtime';
import { ROLE_PERMISSIONS, PERMISSIONS as P, type PermissionCode, type RoleCode } from '../server/permissions/constants';
import { canViewReport } from '../server/permissions/navigation';

type Check = { role: string; feature: string; expected: number; actual: number; passed: boolean; error?: string };
const checks: Check[] = [];
const environment = environmentArg();
const vault = readVault(environment);
if (!vault) throw new Error('Vault akun belum tersedia.');
const pool = prepareEnvironment(environment, vault);
// No outbound mail is sent by this verification run.
process.env.MAILKETING_API_TOKEN = '';
const appErrors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const message = args.find((arg) => arg instanceof Error) as Error | undefined;
  const cause = (message as any)?.cause;
  appErrors.push(String(cause?.message || message?.message || args[0]).split('\n')[0].slice(0, 300));
};
const { handler } = await import('../netlify/functions/api');

async function request(role: string, feature: string, path: string, expected: number, token?: string, method = 'GET', body?: unknown) {
  const url = new URL(path, 'http://localhost');
  const response = await handler({ path: url.pathname, httpMethod: method, headers: token ? { authorization: `Bearer ${token}` } : {}, queryStringParameters: Object.fromEntries(url.searchParams), body: body === undefined ? null : JSON.stringify(body) });
  const payload = JSON.parse(response.body || '{}');
  const check: Check = { role, feature, expected, actual: response.statusCode, passed: response.statusCode === expected };
  if (!check.passed) check.error = payload.error?.message || 'Status tidak sesuai';
  checks.push(check);
  if (!check.passed) console.log(JSON.stringify({ failure: check }));
  return payload;
}

const features: Array<{ name: string; path: string; permission?: PermissionCode; report?: Parameters<typeof canViewReport>[0]; roles?: RoleCode[] }> = [
  { name: 'profil akun', path: '/api/settings/profile' },
  { name: 'yayasan', path: '/api/settings/foundation' },
  { name: 'program donasi', path: '/api/settings/programs' },
  { name: 'tag', path: '/api/settings/tags' },
  { name: 'jamaah', path: '/api/persons?pageSize=5', permission: P.PERSONS_LIST },
  { name: 'event', path: '/api/events', permission: P.EVENTS_VIEW },
  { name: 'bazar', path: '/api/bazaar/overview', permission: P.EVENTS_VIEW },
  { name: 'tenant', path: '/api/bazaar/tenants?pageSize=5', permission: P.EVENTS_VIEW },
  { name: 'kajian rutin', path: '/api/kajian-rutin/series', permission: P.EVENTS_VIEW },
  { name: 'pemateri', path: '/api/kajian-rutin/speakers', permission: P.EVENTS_VIEW },
  { name: 'pengumuman', path: '/api/kajian-rutin/announcements', permission: P.EVENTS_VIEW },
  { name: 'interaksi', path: '/api/interactions?pageSize=5', permission: P.INTERACTIONS_VIEW },
  { name: 'pencarian interaksi', path: '/api/interactions?search=YTS&pageSize=5', permission: P.INTERACTIONS_VIEW },
  { name: 'ruang jamaah', path: '/api/jamaah-room', permission: P.INTERACTIONS_VIEW },
  { name: 'tugas', path: '/api/tasks?page=1&pageSize=5', permission: P.TASKS_VIEW_OWN },
  { name: 'donasi', path: '/api/donations?pageSize=5', permission: P.DONATIONS_LIST },
  { name: 'pencarian donasi', path: '/api/donations?search=YTS&pageSize=5', permission: P.DONATIONS_LIST },
  { name: 'pipeline donatur', path: '/api/donors/pipeline', permission: P.DONORS_VIEW },
  { name: 'master donatur', path: '/api/donors', permission: P.DONORS_VIEW },
  { name: 'program donasi aktif', path: '/api/donation-programs', permission: P.DONATIONS_LIST },
  { name: 'wakaf', path: '/api/waqf?page=1&pageSize=5', permission: P.WAQF_LIST },
  { name: 'pencarian wakaf', path: '/api/waqf?search=YTS&page=1&pageSize=5', permission: P.WAQF_LIST },
  { name: 'kualitas data', path: '/api/data-quality/anomalies', permission: P.DATA_QUALITY_MANAGE },
  { name: 'audit', path: '/api/audit/logs?limit=5', permission: P.AUDIT_VIEW },
  { name: 'riwayat ekspor', path: '/api/audit/exports?limit=5', permission: P.EXPORTS_VIEW_LOG },
  { name: 'manajemen staf', path: '/api/settings/users', permission: P.USERS_MANAGE },
  { name: 'laporan eksekutif', path: '/api/reports/executive-monthly', report: 'executive' },
  { name: 'laporan donasi', path: '/api/reports/donations-reconciliation', report: 'donations' },
  { name: 'laporan kehadiran', path: '/api/reports/attendance-summary', report: 'attendance' },
  { name: 'laporan wakaf', path: '/api/reports/waqf-portfolio', report: 'waqf' },
  { name: 'template komunikasi', path: '/api/automation/templates', permission: P.BROADCAST_HISTORY },
  { name: 'jamaah tidak aktif', path: '/api/automation/inactive-attendees', permission: P.BROADCAST_HISTORY },
  { name: 'kuota broadcast', path: '/api/automation/email-broadcast-quota', permission: P.BROADCAST_HISTORY },
  { name: 'kampanye email', path: '/api/automation/email-campaigns', permission: P.BROADCAST_HISTORY },
  { name: 'daftar blokir email', path: '/api/automation/email-blacklist?limit=5', permission: P.BROADCAST_HISTORY },
  { name: 'broadcast kajian', path: '/api/automation/kajian-broadcast/overview', permission: P.BROADCAST_HISTORY },
  { name: 'template kajian', path: '/api/automation/kajian-broadcast/templates', permission: P.BROADCAST_HISTORY },
  { name: 'log broadcast kajian', path: '/api/automation/kajian-broadcast/log?limit=5', permission: P.BROADCAST_HISTORY },
  { name: 'diagnostik sistem', path: '/api/settings/system-health', permission: P.SYSTEM_CONFIGURE },
];

try {
  const before = await fingerprint(pool);
  await request('anonymous', 'kesehatan API', '/api/health', 200);
  await request('anonymous', 'proteksi sesi', '/api/auth/me', 401);
  for (const account of vault.accounts) {
    const role = account.role as RoleCode;
    const permissions = ROLE_PERMISSIONS[role];
    await request(role, 'tolak sandi salah', '/api/auth/login', 401, undefined, 'POST', { email: account.email, password: account.password + 'invalid' });
    const login = await request(role, 'login', '/api/auth/login', 200, undefined, 'POST', { email: account.email, password: account.password });
    const token = login.data?.token;
    if (!token) continue;
    const identity = await request(role, 'identitas dan sesi', '/api/auth/me', 200, token);
    checks.push({ role, feature: 'role tersimpan sesuai akun', expected: 1, actual: identity.data?.user?.roles?.includes(role) ? 1 : 0, passed: identity.data?.user?.roles?.includes(role) === true });
    const userJson = JSON.stringify(identity);
    checks.push({ role, feature: 'hash tidak bocor', expected: 0, actual: /passwordHash|password_hash|scrypt\$/.test(userJson) ? 1 : 0, passed: !/passwordHash|password_hash|scrypt\$/.test(userJson) });
    await request(role, 'dashboard peran', '/api/dashboard/role-view', 200, token);
    await request(role, 'proteksi dashboard peran lain', `/api/dashboard/role-view?role=${role === 'crm_admin' ? 'leadership_viewer' : 'crm_admin'}`, role === 'crm_admin' ? 200 : 403, token);
    for (let offset = 0; offset < features.length; offset += 3) {
      await Promise.all(features.slice(offset, offset + 3).map((feature) => {
        const allowed = feature.permission ? permissions.includes(feature.permission) : feature.report ? canViewReport(feature.report, permissions) : feature.roles ? feature.roles.includes(role) : true;
        return request(role, feature.name, feature.path, allowed ? 200 : 403, token);
      }));
    }
    await request(role, 'logout', '/api/auth/logout', 200, token, 'POST');
    await request(role, 'token dicabut', '/api/auth/me', 401, token);
    console.log(JSON.stringify({ role, passed: checks.filter((c) => c.role === role && c.passed).length, failed: checks.filter((c) => c.role === role && !c.passed).length }));
  }
  const after = await fingerprint(pool);
  const preserved = before.filter((table) => !['app_users', 'audit_logs'].includes(table.table_name)).every((table) => JSON.stringify(table) === JSON.stringify(after.find((row) => row.table_name === table.table_name)));
  checks.push({ role: 'database', feature: '48 tabel bisnis lama tidak berubah', expected: 1, actual: preserved ? 1 : 0, passed: preserved });
  const report = { environment, runAt: new Date().toISOString(), total: checks.length, passed: checks.filter((c) => c.passed).length, failed: checks.filter((c) => !c.passed).length, checks, appErrors: [...new Set(appErrors)], businessDataPreserved: preserved };
  saveReport(`${environment}-role-verification.json`, report);
  console.log(JSON.stringify({ environment, total: report.total, passed: report.passed, failed: report.failed, appErrors: report.appErrors, businessDataPreserved: preserved }));
  process.exitCode = report.failed ? 1 : 0;
} finally {
  console.error = originalError;
  const { getDbPool } = await import('../server/db/client');
  await getDbPool().end();
  await pool.end();
}
