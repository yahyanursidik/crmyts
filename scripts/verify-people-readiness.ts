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
const expectedUrl =
  environment === 'production'
    ? 'https://app.yts.web.id'
    : targets.staging.previewUrl;
if (!baseUrl || baseUrl !== expectedUrl)
  throw new Error(
    'Target HTTPS harus domain YTS sesuai lingkungan terverifikasi.',
  );
const vault = readVault(environment);
if (!vault) throw new Error('Vault akun staf tidak tersedia.');
const pool = prepareEnvironment(environment, vault);
const checks: Array<{
  role: string;
  feature: string;
  passed: boolean;
  actual?: number;
  expected?: number;
}> = [];
function verify(role: string, feature: string, value: boolean) {
  checks.push({ role, feature, passed: value });
}
async function request(
  role: string,
  feature: string,
  path: string,
  expected = 200,
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
  checks.push({
    role,
    feature,
    passed: response.status === expected && Boolean(json),
    expected,
    actual: response.status,
  });
  return response.status === expected ? json : null;
}
const businessTables = (targets.legacyTables as string[]).filter(
  (table) => !['app_users', 'audit_logs'].includes(table),
);
try {
  const before = await fingerprint(pool, businessTables);
  await request('anonymous', 'direktori memerlukan login', '/api/persons', 401);
  let sampleId = '';
  for (const account of [...vault.accounts].sort(
    (a, b) => Number(b.role === 'crm_admin') - Number(a.role === 'crm_admin'),
  )) {
    const role = account.role;
    const roles = [role as RoleCode];
    const allowed = (permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission(roles, permission);
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
      'direktori aktif',
      '/api/persons?pageSize=5&refreshStats=1',
      allowed(P.PERSONS_LIST) ? 200 : 403,
      token,
    );
    if (directory?.data?.length && !sampleId) sampleId = directory.data[0].id;
    if (directory?.data) {
      verify(
        role,
        'direktori hanya memuat jamaah aktif',
        directory.data.every((person: any) => person.isActive === true),
      );
      if (!allowed(P.TASKS_VIEW_ALL) && !allowed(P.TASKS_VIEW_OWN))
        verify(
          role,
          'tugas tersembunyi tanpa izin',
          directory.data.every((person: any) => !person.nextTask),
        );
    }
    await request(
      role,
      'pilihan PIC dan tag',
      '/api/persons/options',
      allowed(P.PERSONS_LIST) ? 200 : 403,
      token,
    );
    if (!sampleId)
      throw new Error('Tidak ditemukan jamaah untuk verifikasi profil.');
    await request(
      role,
      'konteks jamaah',
      `/api/persons/${sampleId}/summary`,
      allowed(P.PERSONS_LIST) ? 200 : 403,
      token,
    );
    const profile = await request(
      role,
      'profil 360',
      `/api/persons/${sampleId}`,
      allowed(P.PERSONS_VIEW) || allowed(P.PERSONS_VIEW_OPERATIONAL)
        ? 200
        : 403,
      token,
    );
    if (profile?.data) {
      if (!allowed(P.SENSITIVE_NOTES_VIEW))
        verify(
          role,
          'catatan khusus tersembunyi',
          profile.data.sensitiveNotes.length === 0,
        );
      if (!allowed(P.INTERACTIONS_VIEW))
        verify(
          role,
          'interaksi tersembunyi tanpa izin',
          profile.data.interactions.length === 0,
        );
      if (!allowed(P.WAQF_VIEW_DETAIL))
        verify(
          role,
          'kasus wakaf tersembunyi tanpa izin',
          profile.data.waqfCases.length === 0,
        );
      if (!allowed(P.DONATIONS_VIEW_DETAIL))
        verify(
          role,
          'donasi terverifikasi tersembunyi',
          profile.data.donations.every(
            (row: any) => row.verificationStatus === 'unverified',
          ),
        );
    }
    const linked = [
      {
        path: 'tasks',
        access: allowed(P.TASKS_VIEW_ALL) || allowed(P.TASKS_VIEW_OWN),
      },
      { path: 'donations', access: allowed(P.DONATIONS_LIST) },
      { path: 'waqf', access: allowed(P.WAQF_LIST) },
      { path: 'interactions', access: allowed(P.INTERACTIONS_VIEW) },
    ];
    for (const module of linked) {
      const result = await request(
        role,
        `konteks ${module.path}`,
        `/api/${module.path}?page=1&pageSize=5&personId=${sampleId}`,
        module.access ? 200 : 403,
        token,
      );
      if (result?.data) {
        verify(
          role,
          `relasi jamaah ${module.path}`,
          result.data.every(
            (row: any) => (row.personId || row.person?.id) === sampleId,
          ),
        );
        if (module.path === 'donations' && !allowed(P.DONATIONS_VIEW_DETAIL))
          verify(
            role,
            'batas akses transaksi unverified',
            result.data.every(
              (row: any) => row.verificationStatus === 'unverified',
            ) && Number(result.meta.stats.totalVerifiedNominalRupiah) === 0,
          );
      }
    }
  }
  const after = await fingerprint(pool, businessTables);
  verify(
    'database',
    '48 tabel bisnis tidak berubah selama pemeriksaan',
    JSON.stringify(before) === JSON.stringify(after),
  );
  const report = {
    environment,
    baseUrl,
    checkedAt: new Date().toISOString(),
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    businessTablesUnchanged: JSON.stringify(before) === JSON.stringify(after),
    sessionsRevoked: false,
    checks,
  };
  saveReport(`${environment}-people-https-verification.json`, report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((row) => !row.passed) }),
  );
  if (report.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
