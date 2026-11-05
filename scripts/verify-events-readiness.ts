import {
  environmentArg,
  prepareEnvironment,
  readVault,
  saveReport,
  fingerprint,
  targets,
} from './access-runtime';
import {
  hasPermission,
  PERMISSIONS as P,
  type RoleCode,
} from '../server/permissions/constants';
const environment = environmentArg();
const baseUrl = process.argv[process.argv.indexOf('--base-url') + 1];
const target =
  environment === 'production'
    ? 'https://app.yts.web.id'
    : targets.staging.previewUrl;
if (baseUrl !== target)
  throw new Error('Gunakan target HTTPS YTS sesuai lingkungan terverifikasi.');
const vault = readVault(environment);
if (!vault) throw new Error('Vault staf tidak tersedia.');
const pool = prepareEnvironment(environment, vault);
pool.on('error', () => {
  /* A failed idle test connection is replaced by the pool. */
});
const tables = (targets.legacyTables as string[]).filter(
  (table) => !['app_users', 'audit_logs'].includes(table),
);
const checks: Array<{
  role: string;
  feature: string;
  passed: boolean;
  actual?: number;
}> = [];
function verify(role: string, feature: string, passed: boolean) {
  checks.push({ role, feature, passed });
}
async function request(
  role: string,
  feature: string,
  path: string,
  expected: number | number[],
  token?: string,
  body?: unknown,
) {
  const response = await fetch(new URL(path, baseUrl), {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json().catch(() => null)) as any;
  const passed =
    (Array.isArray(expected) ? expected : [expected]).includes(
      response.status,
    ) && Boolean(json);
  checks.push({ role, feature, passed, actual: response.status });
  return passed ? json : null;
}
let paidSampleId = '';
let sampleId = '',
  linkedPerson = '',
  largestRoster = 0,
  paymentReviewCount = 0;
try {
  const before = await fingerprint(pool, tables);
  await request('anonymous', 'direktori memerlukan login', '/api/events', 401);
  for (const account of [...vault.accounts].sort(
    (a, b) => Number(b.role === 'crm_admin') - Number(a.role === 'crm_admin'),
  )) {
    const role = account.role;
    const allowed = (permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission([role as RoleCode], permission);
    const login = await request(
      role,
      'login staf',
      '/api/auth/login',
      200,
      undefined,
      { email: account.email, password: account.password },
    );
    const token = login?.data?.token;
    if (!token) continue;
    await request(role, 'sesi staf', '/api/auth/me', 200, token);
    const directory = await request(
      role,
      'direktori Events',
      '/api/events',
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    if (directory?.data) {
      const largest = [...directory.data].sort(
        (a: any, b: any) => b.attendanceCount - a.attendanceCount,
      )[0];
      sampleId ||= largest?.id;
      paidSampleId ||= [...directory.data].filter((event: any) => event.isPaid).sort((a: any, b: any) => b.attendanceCount - a.attendanceCount)[0]?.id || '';
      largestRoster = Math.max(largestRoster, largest?.attendanceCount || 0);
      verify(
        role,
        'direktori tidak membawa token privat dan formulir',
        directory.data.every(
          (event: any) =>
            !('formConfig' in event) &&
            !('staffRegistrationToken' in event) &&
            !('attendances' in event),
        ),
      );
    }
    if (!sampleId) throw new Error('Event sampel belum tersedia.');
    const access = allowed(P.EVENTS_VIEW) ? 200 : 403;
    const detail = await request(
      role,
      'peserta dan riwayat hadir',
      `/api/events/${sampleId}`,
      access,
      token,
    );
    const settings = await request(
      role,
      'pengaturan tanpa unduhan roster',
      `/api/events/${sampleId}/settings`,
      access,
      token,
    );
    if (detail?.data) {
      linkedPerson ||= detail.data.participants[0]?.personId;
      verify(
        role,
        'roster satu sumber dan total konsisten',
        detail.data.participants.length === detail.data.totalParticipants &&
          !('attendances' in detail.data),
      );
      verify(
        role,
        'jumlah hadir sesuai riwayat',
        detail.data.attendedCount ===
          detail.data.participants.filter(
            (row: any) => row.status === 'attended',
          ).length,
      );
      paymentReviewCount = Math.max(
        paymentReviewCount,
        detail.data.paymentReviewCount || 0,
      );
    }
    if (paidSampleId && allowed(P.EVENTS_VIEW)) {
      const paid = await request(role, 'roster event berbayar dan status lama', `/api/events/${paidSampleId}`, 200, token);
      if (paid?.data) {
        const expectedReview = paid.data.participants.filter((row: any) => row.paymentStatus === 'free' && !row.isStaffRegistration);
        verify(role, 'status pembayaran lama tetap tersimpan dan ditandai', paid.data.isPaid === true && paid.data.paymentReviewCount === expectedReview.length && expectedReview.every((row: any) => row.paymentNeedsReview === true));
        paymentReviewCount = Math.max(paymentReviewCount, paid.data.paymentReviewCount || 0);
      }
    }
    if (settings?.data)
      verify(
        role,
        'pengaturan ringkas konsisten',
        settings.data.participants.length === 0 &&
          settings.data.totalParticipants === detail.data.totalParticipants,
      );
    for (const [feature, suffix, expected] of [
      [
        'bazar, booth, tenant',
        'bazaar',
        allowed(P.EVENTS_VIEW) ? [200, 404] : 403,
      ],
      ['riwayat broadcast', 'email-broadcasts', access],
      ['kuota kirim hari ini', 'email-broadcasts/today', access],
      ['template event', 'email-broadcast-templates', access],
    ] as const)
      await request(
        role,
        feature,
        `/api/events/${sampleId}/${suffix}`,
        expected as number | number[],
        token,
      );
    if (linkedPerson)
      await request(
        role,
        'tautan profil Jamaah',
        `/api/persons/${linkedPerson}/summary`,
        allowed(P.PERSONS_LIST) ? 200 : 403,
        token,
      );
  }
  const after = await fingerprint(pool, tables);
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  verify('database', '48 tabel bisnis tidak berubah', unchanged);
  const report = {
    environment,
    baseUrl,
    at: new Date().toISOString(),
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    sampleId,
    largestRoster,
    paymentReviewCount,
    businessTablesUnchanged: unchanged,
    sessionsRevoked: false,
    checks,
  };
  saveReport(`${environment}-events-https-verification.json`, report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((row) => !row.passed) }),
  );
  if (report.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
