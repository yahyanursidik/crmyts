import assert from 'node:assert/strict';
import { environmentArg, fingerprint, prepareEnvironment, readVault, saveReport, targets } from './access-runtime';

const environment = environmentArg();
const baseUrl = process.argv.includes('--base-url') ? process.argv[process.argv.indexOf('--base-url') + 1] : '';
if (baseUrl && (environment === 'production' ? baseUrl !== 'https://app.yts.web.id' : !/^https:\/\/deploy-preview-\d+--crmyts\.netlify\.app$/.test(baseUrl))) throw new Error('Alamat verifikasi tidak sesuai lingkungan.');
const vault = readVault(environment);
if (!vault) throw new Error('Vault staf belum tersedia.');
const account = vault.accounts.find((item) => item.role === 'crm_admin')!;
const pool = prepareEnvironment(environment, vault);
process.env.MAILKETING_API_TOKEN = '';
const handler = baseUrl ? null : (await import('../netlify/functions/api')).handler;
let token = '';
const results: string[] = [];
function check(condition: unknown, name: string) { assert.ok(condition, name); results.push(name); }
async function request(path: string, method = 'GET', body?: unknown) {
  const url = new URL(path, baseUrl || 'http://localhost');
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const response = baseUrl ? await (async () => {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { statusCode: res.status, body: await res.text() };
  })() : await handler!({ path: url.pathname, httpMethod: method, headers, queryStringParameters: Object.fromEntries(url.searchParams), body: body ? JSON.stringify(body) : null });
  return { status: response.statusCode, ...JSON.parse(response.body) };
}
const tables = targets.legacyTables.filter((table: string) => !['app_users', 'audit_logs'].includes(table));
try {
  const before = await fingerprint(pool, tables);
  const login = await request('/api/auth/login', 'POST', { email: account.email, password: account.password });
  check(login.status === 200 && login.data?.token, 'Admin login'); token = login.data.token;
  const summary = await request('/api/dashboard/stats');
  check(summary.status === 200, 'Dashboard summary');
  const agenda = await request('/api/dashboard/operations');
  check(agenda.status === 200, 'Operational agenda');
  const live = (await pool.query(`SELECT
    (SELECT count(*)::int FROM persons WHERE is_active) AS jamaah,
    (SELECT count(*)::int FROM tasks WHERE status IN ('pending','in_progress','waiting') AND due_at < now()) AS overdue,
    (SELECT count(*)::int FROM donations WHERE verification_status='unverified') AS unverified,
    (SELECT coalesce(sum(amount_rupiah),0)::text FROM donations WHERE verification_status='verified' AND donation_date >= date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta' AND donation_date < (date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta')+interval '1 month') AT TIME ZONE 'Asia/Jakarta') AS month_donations,
    (SELECT count(*)::int FROM events WHERE (status='scheduled' AND start_at>=now()) OR (status='ongoing' AND (end_at IS NULL OR end_at>=now()))) AS upcoming`)).rows[0];
  for (const [key, expected] of Object.entries({ totalJamaah: live.jamaah, overdueTasks: live.overdue, unverifiedDonations: live.unverified, monthDonationsRupiah: Number(live.month_donations) })) check(summary.data.kpis[key] === expected, `SQL parity: ${key}`);
  check(agenda.data.upcomingCount === live.upcoming, 'SQL parity: upcoming events');
  check(agenda.data.upcomingEvents.length <= 4 && agenda.data.paymentReviews.length <= 5, 'Bounded queues');
  check(!/formConfig|staffRegistrationToken|gateKey|phoneE164|passwordHash/.test(JSON.stringify(agenda.data)), 'Agenda contains no private access keys or participant contacts');
  for (const event of agenda.data.upcomingEvents) {
    const counts = (await pool.query("SELECT count(*) filter(where status in ('registered','attended'))::int AS registered, count(*) filter(where status='attended')::int AS attended FROM event_attendance WHERE event_id=$1", [event.id])).rows[0];
    check(event.registered === counts.registered && event.attended === counts.attended, 'SQL parity: event participant counts');
  }
  const overdue = await request('/api/tasks?isOverdue=true&pageSize=100');
  check(overdue.status === 200 && overdue.data.every((item: any) => ['pending', 'in_progress', 'waiting'].includes(item.status) && item.isOverdue), 'Overdue filter excludes closed tasks');
  const unverified = await request('/api/donations?verificationStatus=unverified&pageSize=100');
  check(unverified.status === 200 && unverified.data.every((item: any) => item.verificationStatus === 'unverified'), 'Donation review filter');
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const monthKey = `${month.find((part) => part.type === 'year')!.value}-${month.find((part) => part.type === 'month')!.value}`;
  const monthly = await request(`/api/donations?verificationStatus=verified&month=${monthKey}&pageSize=100`);
  check(monthly.status === 200 && monthly.data.every((item: any) => item.verificationStatus === 'verified' && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date(item.donationDate)) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date())), 'Monthly donation drill-down uses WIB');
  check((await request('/api/donations?month=2026-99')).status === 400, 'Invalid donation month rejected');
  check(summary.data.charts.attendanceTrend.every((item: any) => new Date(item.date).getTime() <= Date.now()), 'Attendance trend excludes future events');
  const role = await request('/api/dashboard/role-view?role=crm_admin');
  check(!JSON.stringify(role.data).includes('latensi normal'), 'No unmeasured healthy-system claim');
  const after = await fingerprint(pool, tables);
  check(JSON.stringify(before) === JSON.stringify(after), 'Legacy business data preserved');
  const report = { checkedAt: new Date().toISOString(), environment, baseUrl: baseUrl || 'local handler', passed: results.length, failed: 0, businessDataPreserved: true, checks: results };
  saveReport(`${environment}-admin-dashboard-verification.json`, report);
  console.log(JSON.stringify({ ...report, checks: undefined }));
} finally {
  if (token) await request('/api/auth/logout', 'POST').catch(() => {});
  await pool.end();
}
