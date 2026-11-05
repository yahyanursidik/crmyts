import { randomUUID } from 'node:crypto';
import {
  prepareEnvironment,
  readVault,
  saveReport,
  targets,
} from './access-runtime';
import {
  hasPermission,
  PERMISSIONS,
  type RoleCode,
} from '../server/permissions/constants';

if (process.argv[process.argv.indexOf('--environment') + 1] !== 'staging')
  throw new Error('Uji perubahan People hanya diizinkan pada staging.');
const vault = readVault('staging');
if (!vault) throw new Error('Vault staging tidak tersedia.');
const pool = prepareEnvironment('staging', vault);
process.env.MAILKETING_API_TOKEN = '';
process.env.MAILKETING_API_KEY = '';
const { handler } = await import('../netlify/functions/api');
const marker = `UAT People ${Date.now().toString(36)}`;
const phone = `+628${Date.now().toString().slice(-11)}`;
const email = `${marker.replace(/ /g, '-').toLowerCase()}@example.test`;
const dueAt = new Date(Date.now() + 86400000 * 3).toISOString();
const tokens = new Map<string, string>();
const checks: Array<{
  feature: string;
  passed: boolean;
  actual?: number;
  expected?: number | number[];
}> = [];
const timings: Array<{ path: string; ms: number }> = [];
const appErrors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const error = args.find((arg) => arg instanceof Error) as Error | undefined;
  appErrors.push(
    String((error as any)?.cause?.message || error?.message || args[0])
      .split('\n')[0]
      .slice(0, 180),
  );
};
function verify(feature: string, passed: unknown) {
  checks.push({ feature, passed: passed === true });
  if (passed !== true) throw new Error(feature);
}
async function api(
  role: string | null,
  feature: string,
  method: string,
  path: string,
  body?: unknown,
  expected: number | number[] = 200,
) {
  const url = new URL(path, 'http://localhost');
  const started = Date.now();
  const response = await handler({
    path: url.pathname,
    httpMethod: method,
    headers: role ? { authorization: `Bearer ${tokens.get(role)}` } : {},
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (method === 'GET')
    timings.push({ path: url.pathname, ms: Date.now() - started });
  const json = JSON.parse(response.body || '{}');
  checks.push({
    feature,
    passed: (Array.isArray(expected) ? expected : [expected]).includes(
      response.statusCode,
    ),
    actual: response.statusCode,
    expected,
  });
  if (
    !(Array.isArray(expected) ? expected : [expected]).includes(
      response.statusCode,
    )
  )
    throw new Error(
      `${feature}: HTTP ${response.statusCode}; ${json.error?.message || 'status tidak sesuai'}`,
    );
  return json;
}
async function legacyRows() {
  const tables = (targets.legacyTables as string[]).filter(
    (name) =>
      ![
        'app_users',
        'audit_logs',
        'rate_limits',
        'kajian_rutin_rate_limits',
      ].includes(name),
  );
  return (
    await pool.query(
      tables
        .map(
          (name) =>
            `SELECT '${name}' AS table_name,md5(to_jsonb(r)::text) AS row_hash,count(*)::int AS copies FROM public."${name}" r GROUP BY md5(to_jsonb(r)::text)`,
        )
        .join(' UNION ALL '),
    )
  ).rows;
}
let personId = '',
  errorMessage = '',
  originalRows: any[] = [];
try {
  originalRows = await legacyRows();
  for (const account of vault.accounts) {
    const login = await api(
      null,
      `login ${account.role}`,
      'POST',
      '/api/auth/login',
      { email: account.email, password: account.password },
    );
    tokens.set(account.role, login.data.token);
  }
  const cs = vault.accounts.find((account) => account.role === 'cs_officer')!;
  const tag = (
    await pool.query(
      'INSERT INTO tags(name,category) VALUES($1,$2) RETURNING id',
      [marker, 'UAT'],
    )
  ).rows[0];
  const options = (
    await api(
      'data_steward',
      'pilihan PIC dan tag aktif',
      'GET',
      '/api/persons/options',
    )
  ).data;
  verify(
    'PIC dan tag terhubung master',
    options.staff.some((row: any) => row.id === cs.id) &&
      options.tags.some((row: any) => row.id === tag.id),
  );
  await api(
    'data_steward',
    'tolak nomor tidak valid',
    'POST',
    '/api/persons',
    { fullName: marker, phoneE164: 'nomor123' },
    400,
  );
  await api(
    'data_steward',
    'tolak PIC tidak ditemukan',
    'POST',
    '/api/persons',
    { fullName: marker, ownerUserId: randomUUID() },
    400,
  );
  const created = await api(
    'data_steward',
    'buat jamaah PIC peran dan tag',
    'POST',
    '/api/persons',
    {
      fullName: marker,
      phoneE164: phone,
      email,
      cityRegency: 'Kota Uji',
      ownerUserId: cs.id,
      roleCodes: ['jamaah', 'relawan'],
      tagIds: [tag.id],
    },
    201,
  );
  personId = created.data.id;
  const assignedBefore = (
    await pool.query(
      'SELECT assigned_at::text FROM person_roles WHERE person_id=$1 ORDER BY role_code',
      [personId],
    )
  ).rows;
  await api(
    'data_steward',
    'edit profil tanpa mengganti tanggal peran',
    'PUT',
    `/api/persons/${personId}`,
    {
      occupation: 'Pengujian People',
      roleCodes: ['jamaah', 'relawan'],
      tagIds: [tag.id],
    },
  );
  verify(
    'riwayat penetapan peran tetap utuh',
    JSON.stringify(assignedBefore) ===
      JSON.stringify(
        (
          await pool.query(
            'SELECT assigned_at::text FROM person_roles WHERE person_id=$1 ORDER BY role_code',
            [personId],
          )
        ).rows,
      ),
  );
  const duplicate = (
    await api(
      'data_steward',
      'pemeriksaan kontak duplikat',
      'GET',
      `/api/persons/check-duplicate?phone=${encodeURIComponent(phone)}`,
    )
  ).data;
  verify(
    'duplikat mengarah identitas yang sama',
    duplicate.candidates.some((row: any) => row.id === personId),
  );
  const base = `/api/persons?search=${encodeURIComponent(marker)}&refreshStats=1`;
  for (const account of vault.accounts) {
    const roles = [account.role as RoleCode];
    const canList = hasPermission(roles, PERMISSIONS.PERSONS_LIST);
    const canProfile = [
      PERMISSIONS.PERSONS_VIEW,
      PERMISSIONS.PERSONS_VIEW_OPERATIONAL,
    ].some((permission) => hasPermission(roles, permission));
    await api(
      account.role,
      `direktori ${account.role}`,
      'GET',
      base,
      undefined,
      canList ? 200 : 403,
    );
    await api(
      account.role,
      `konteks jamaah ${account.role}`,
      'GET',
      `/api/persons/${personId}/summary`,
      undefined,
      canList ? 200 : 403,
    );
    await api(
      account.role,
      `profil ${account.role}`,
      'GET',
      `/api/persons/${personId}`,
      undefined,
      canProfile ? 200 : 403,
    );
  }
  for (const query of [
    'page=abc',
    'pageSize=101',
    'tagId=invalid',
    'ownerUserId=invalid',
    'attendanceFilter=invalid',
  ])
    await api(
      'crm_admin',
      `validasi ${query}`,
      'GET',
      `/api/persons?${query}`,
      undefined,
      400,
    );
  await api(
    'crm_admin',
    'validasi UUID profil',
    'GET',
    '/api/persons/invalid',
    undefined,
    400,
  );
  const events: string[] = [];
  for (const suffix of ['Hadir', 'Terdaftar']) {
    const event = await api(
      'event_admin',
      `buat event ${suffix}`,
      'POST',
      '/api/events',
      {
        title: `${marker} ${suffix}`,
        category: 'Kajian',
        speaker: 'Ustadz Uji',
        startAt: dueAt,
        endAt: new Date(Date.parse(dueAt) + 7200000).toISOString(),
        quota: 10,
      },
      201,
    );
    events.push(event.data.id);
  }
  await pool.query(
    "INSERT INTO event_attendance(event_id,person_id,status,check_in_at,ticket_code) VALUES($1,$2,'attended',now(),$3),($4,$2,'registered',null,$5)",
    [events[0], personId, `${marker}-H`, events[1], `${marker}-R`],
  );
  const series = (
    await api(
      'event_admin',
      'buat seri rutin',
      'POST',
      '/api/kajian-rutin/series',
      {
        title: `${marker} Rutin`,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
      },
      201,
    )
  ).data;
  const sessions: string[] = [];
  for (let index = 0; index < 2; index++) {
    const session = (
      await api(
        'event_admin',
        `buat sesi rutin ${index}`,
        'POST',
        `/api/kajian-rutin/series/${series.id}/sessions`,
        {
          sessionDate: new Date(Date.now() + 86400000 * (4 + index))
            .toISOString()
            .slice(0, 10),
        },
        201,
      )
    ).data;
    sessions.push(session.id);
  }
  await pool.query(
    "INSERT INTO kajian_rutin_attendance(session_id,series_id,google_sub,full_name,email,phone,status) VALUES($1,$2,$3,$4,$5,null,'present'),($1,$2,$6,$4,null,$7,'present'),($8,$2,$9,$4,$5,null,'excused')",
    [
      sessions[0],
      series.id,
      `${marker}-one`,
      marker,
      ` ${email.toUpperCase()} `,
      `${marker}-two`,
      phone.replace('+62', '0'),
      sessions[1],
      `${marker}-excused`,
    ],
  );
  const profile = (
    await api(
      'crm_admin',
      'profil presensi lintas event dan rutin',
      'GET',
      `/api/persons/${personId}`,
    )
  ).data;
  verify(
    'kehadiran aktual hanya dua kegiatan unik',
    profile.metrics.totalAttendances === 2,
  );
  verify(
    'pendaftaran tidak diklaim sebagai hadir',
    profile.timeline.some(
      (row: any) => row.title === `Pendaftaran: ${marker} Terdaftar`,
    ),
  );
  verify(
    'email dan nomor lokal merujuk satu sesi rutin',
    profile.routineAttendance.filter(
      (row: any) => row.sessionId === sessions[0],
    ).length === 1,
  );
  const directory = await api(
    'crm_admin',
    'direktori hitung kehadiran aktual',
    'GET',
    base + '&attendanceFilter=multi',
  );
  verify(
    'jumlah direktori sama dengan profil',
    directory.data.length === 1 && directory.data[0].attendanceCount === 2,
  );
  for (const filter of ['single', 'none'])
    verify(
      `jamaah rutin tidak masuk filter ${filter}`,
      (
        await api(
          'crm_admin',
          `filter ${filter}`,
          'GET',
          base + `&attendanceFilter=${filter}`,
        )
      ).data.length === 0,
    );
  for (const filter of [
    `ownerUserId=${cs.id}`,
    `tagId=${tag.id}`,
    'roleCode=wakif_relawan',
  ])
    verify(
      `filter relasi ${filter}`,
      (
        await api('crm_admin', `filter ${filter}`, 'GET', base + '&' + filter)
      ).data.some((row: any) => row.id === personId),
    );
  const interaction = (
    await api(
      'cs_officer',
      'interaksi terbatas dan tugas atomik',
      'POST',
      `/api/persons/${personId}/interactions`,
      {
        channel: 'whatsapp',
        summary: `${marker} terbatas`,
        sensitivityLevel: 'restricted',
        nextAction: 'Hubungi kembali',
        createFollowUpTask: true,
        taskDueAt: dueAt,
      },
      201,
    )
  ).data;
  verify(
    'tugas terhubung interaksi dan jamaah',
    Boolean(interaction.createdTask?.id) &&
      interaction.createdTask.personId === personId,
  );
  const beforeInvalidInteraction = (
    await pool.query(
      'SELECT count(*)::int AS count FROM interactions WHERE person_id=$1',
      [personId],
    )
  ).rows[0].count;
  await api(
    'cs_officer',
    'tindak lanjut tidak lengkap ditolak',
    'POST',
    `/api/persons/${personId}/interactions`,
    { channel: 'whatsapp', summary: marker, createFollowUpTask: true },
    400,
  );
  verify(
    'validasi tidak meninggalkan interaksi parsial',
    beforeInvalidInteraction ===
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM interactions WHERE person_id=$1',
          [personId],
        )
      ).rows[0].count,
  );
  const own = (
    await api(
      'cs_officer',
      'interaksi dan tugas sendiri terlihat',
      'GET',
      `/api/persons/${personId}`,
    )
  ).data;
  verify(
    'CS melihat interaksi dan tugasnya',
    own.interactions.some(
      (row: any) => row.id === interaction.interaction.id,
    ) && own.tasks.some((row: any) => row.id === interaction.createdTask.id),
  );
  const other = (
    await api(
      'fundraising_officer',
      'isolasi profil staf lain',
      'GET',
      `/api/persons/${personId}`,
    )
  ).data;
  verify(
    'interaksi terbatas dan tugas staf lain tidak bocor',
    !other.interactions.some(
      (row: any) => row.id === interaction.interaction.id,
    ) && !other.tasks.some((row: any) => row.id === interaction.createdTask.id),
  );
  verify(
    'direktori tidak membocorkan tugas staf lain',
    !(await api('fundraising_officer', 'isolasi tugas direktori', 'GET', base))
      .data[0].nextTask,
  );
  verify(
    'modul interaksi memakai privasi yang sama',
    !(
      await api(
        'fundraising_officer',
        'isolasi modul interaksi',
        'GET',
        `/api/interactions?personId=${personId}`,
      )
    ).data.some((row: any) => row.id === interaction.interaction.id),
  );
  const scopedTasks = await api(
    'cs_officer',
    'filter tugas jamaah',
    'GET',
    `/api/tasks?page=1&personId=${personId}`,
  );
  verify(
    'modul tugas menerapkan konteks jamaah',
    scopedTasks.data.length === 1 &&
      scopedTasks.data.every((row: any) => row.person?.id === personId),
  );
  verify(
    'paginasi tugas sesuai jamaah terpilih',
    scopedTasks.meta.pagination.totalCount === 1 &&
      scopedTasks.meta.pagination.totalPages === 1,
  );
  verify(
    'ringkasan tugas mengikuti jamaah',
    scopedTasks.meta.stats.totalAll === 1,
  );
  const scopedInteractions = await api(
    'fundraising_officer',
    'ringkasan interaksi dibatasi jamaah dan privasi',
    'GET',
    `/api/interactions?personId=${personId}`,
  );
  verify(
    'ringkasan interaksi terbatas tidak bocor',
    scopedInteractions.meta.stats.totalAll === 0,
  );
  await api(
    'cs_officer',
    'selesaikan tugas dari profil',
    'PATCH',
    `/api/tasks/${interaction.createdTask.id}/status`,
    { status: 'completed' },
  );
  await api(
    'cs_officer',
    'buka kembali tugas',
    'PATCH',
    `/api/tasks/${interaction.createdTask.id}/status`,
    { status: 'pending' },
  );
  const program = (
    await pool.query('SELECT id FROM donation_programs WHERE is_active LIMIT 1')
  ).rows[0];
  const donation = (
    await api(
      'fundraising_officer',
      'catat donasi jamaah',
      'POST',
      '/api/donations',
      {
        personId,
        programId: program.id,
        amountRupiah: 125000,
        donationDate: new Date().toISOString(),
        paymentMethod: 'bank_transfer',
        externalReference: marker,
      },
      201,
    )
  ).data;
  await api(
    'finance_verifier',
    'verifikasi donasi jamaah',
    'POST',
    `/api/donations/${donation.id}/verify`,
    { reason: marker },
  );
  verify(
    'modul donasi tersaring jamaah',
    (
      await api(
        'finance_verifier',
        'filter donasi jamaah',
        'GET',
        `/api/donations?personId=${personId}`,
      )
    ).data.every((row: any) => row.person?.id === personId),
  );
  const waqf = (
    await api(
      'waqf_officer',
      'kasus wakaf jamaah',
      'POST',
      '/api/waqf',
      {
        personId,
        waqfType: 'uang',
        estimatedValueRupiah: 1000000,
        notesSummary: marker,
      },
      201,
    )
  ).data;
  verify(
    'modul wakaf tersaring jamaah',
    (
      await api(
        'waqf_officer',
        'filter wakaf jamaah',
        'GET',
        `/api/waqf?personId=${personId}`,
      )
    ).data.every((row: any) => row.person?.id === personId),
  );
  const financial = (
    await api(
      'crm_admin',
      'profil donasi dan wakaf terhubung',
      'GET',
      `/api/persons/${personId}`,
    )
  ).data;
  const scopedDonations = await api(
    'finance_verifier',
    'ringkasan donasi jamaah',
    'GET',
    `/api/donations?personId=${personId}`,
  );
  verify(
    'nominal dan jumlah donasi sesuai jamaah',
    scopedDonations.meta.stats.totalVerifiedNominalRupiah === 125000 &&
      scopedDonations.meta.stats.verifiedCount === 1,
  );
  const unverifiedView = await api(
    'fundraising_officer',
    'batas akses donasi belum diverifikasi',
    'GET',
    `/api/donations?personId=${personId}`,
  );
  verify(
    'transaksi terverifikasi tidak bocor ke akses unverified',
    unverifiedView.data.length === 0 &&
      unverifiedView.meta.stats.totalVerifiedNominalRupiah === 0 &&
      unverifiedView.meta.stats.verifiedCount === 0,
  );
  const scopedWaqf = await api(
    'waqf_officer',
    'ringkasan kasus wakaf jamaah',
    'GET',
    `/api/waqf?personId=${personId}`,
  );
  verify(
    'jumlah dan estimasi wakaf sesuai jamaah',
    scopedWaqf.meta.stats.totalCases === 1 &&
      scopedWaqf.meta.stats.totalEstimatedValueRupiah === 1000000,
  );
  for (const [role, path] of [
    ['cs_officer', 'tasks'],
    ['cs_officer', 'interactions'],
    ['finance_verifier', 'donations'],
    ['waqf_officer', 'waqf'],
  ])
    await api(
      role!,
      `validasi filter jamaah ${path}`,
      'GET',
      `/api/${path}?personId=invalid`,
      undefined,
      400,
    );
  verify(
    'profil menampilkan nominal sah dan wakaf aktif',
    financial.metrics.verifiedTotalDonationsRupiah === 125000 &&
      financial.metrics.activeWaqfCasesCount === 1 &&
      financial.waqfCases.some((row: any) => row.id === waqf.id),
  );
  await api(
    'crm_admin',
    'tolak catatan kedaluwarsa sejak dibuat',
    'POST',
    `/api/persons/${personId}/sensitive-notes`,
    {
      noteText: marker,
      reason: marker,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    },
    400,
  );
  const note = (
    await api(
      'crm_admin',
      'buat catatan khusus',
      'POST',
      `/api/persons/${personId}/sensitive-notes`,
      { noteText: marker, reason: marker, expiresAt: dueAt },
      201,
    )
  ).data;
  await api(
    'cs_officer',
    'proteksi catatan khusus',
    'POST',
    `/api/persons/${personId}/sensitive-notes`,
    { noteText: marker, reason: marker },
    403,
  );
  verify(
    'catatan khusus tidak masuk profil CS',
    !(
      await api(
        'cs_officer',
        'profil CS tanpa catatan khusus',
        'GET',
        `/api/persons/${personId}`,
      )
    ).data.sensitiveNotes.length,
  );
  await api(
    'crm_admin',
    'arsip catatan khusus',
    'POST',
    `/api/persons/${personId}/sensitive-notes/${note.id}/archive`,
  );
  verify(
    'catatan terarsip tidak tampil',
    !(
      await api(
        'crm_admin',
        'profil tanpa catatan terarsip',
        'GET',
        `/api/persons/${personId}`,
      )
    ).data.sensitiveNotes.some((row: any) => row.id === note.id),
  );
  const expiring = (
    await api(
      'crm_admin',
      'buat catatan yang akan habis berlaku',
      'POST',
      `/api/persons/${personId}/sensitive-notes`,
      { noteText: marker, reason: marker, expiresAt: dueAt },
      201,
    )
  ).data;
  await pool.query(
    "UPDATE sensitive_notes SET expires_at=now()-interval '1 hour' WHERE id=$1 AND person_id=$2",
    [expiring.id, personId],
  );
  verify(
    'catatan habis berlaku tersembunyi',
    !(
      await api(
        'crm_admin',
        'profil tanpa catatan kedaluwarsa',
        'GET',
        `/api/persons/${personId}`,
      )
    ).data.sensitiveNotes.some((row: any) => row.id === expiring.id),
  );
  const childTables = [
    'event_attendance',
    'interactions',
    'tasks',
    'donations',
    'waqf_cases',
    'person_roles',
    'person_tags',
    'sensitive_notes',
  ];
  async function childState() {
    return (
      await pool.query(
        childTables
          .map(
            (table) =>
              `SELECT '${table}' AS name,count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' ORDER BY md5(to_jsonb(r)::text)),'')) AS hash FROM ${table} r WHERE person_id=$1`,
          )
          .join(' UNION ALL '),
        [personId],
      )
    ).rows;
  }
  const beforeArchive = await childState();
  await api(
    'cs_officer',
    'CS tidak mengarsipkan tanpa izin',
    'DELETE',
    `/api/persons/${personId}`,
    undefined,
    403,
  );
  await api(
    'crm_admin',
    'arsip atomik tolak ID hilang',
    'POST',
    '/api/persons/bulk-delete',
    { personIds: [personId, randomUUID()], confirmation: 'ARSIPKAN' },
    409,
  );
  verify(
    'arsip gagal tidak mengubah jamaah',
    (
      await api(
        'crm_admin',
        'cek status setelah konflik arsip',
        'GET',
        `/api/persons/${personId}/summary`,
      )
    ).data.isActive === true,
  );
  await api(
    'crm_admin',
    'arsip jamaah dan pertahankan riwayat',
    'DELETE',
    `/api/persons/${personId}`,
  );
  verify(
    'arsip tidak merusak semua relasi',
    JSON.stringify(beforeArchive) === JSON.stringify(await childState()),
  );
  verify(
    'arsip keluar dari direktori aktif',
    !(await api('crm_admin', 'daftar aktif setelah arsip', 'GET', base)).data
      .length,
  );
  verify(
    'arsip bisa ditemukan dan dipulihkan',
    (await api('crm_admin', 'daftar arsip', 'GET', base + '&status=archived'))
      .data[0].id === personId,
  );
  verify(
    'profil arsip tetap dapat dibaca',
    (
      await api(
        'crm_admin',
        'riwayat profil arsip',
        'GET',
        `/api/persons/${personId}`,
      )
    ).data.metrics.totalAttendances === 2,
  );
  await api(
    'crm_admin',
    'pulihkan identitas yang sama',
    'POST',
    `/api/persons/${personId}/restore`,
  );
  verify(
    'pemulihan mengembalikan profil dan relasi',
    (await api('crm_admin', 'direktori setelah pemulihan', 'GET', base)).data[0]
      .id === personId &&
      JSON.stringify(beforeArchive) === JSON.stringify(await childState()),
  );
  const audits = (
    await pool.query(
      "SELECT action FROM audit_logs WHERE entity_id=$1 AND action IN ('create_person','update_person','archive_person','restore_person')",
      [personId],
    )
  ).rows;
  verify(
    'mutasi utama tercatat pada audit',
    new Set(audits.map((row: any) => row.action)).size === 4,
  );
  await api(
    'data_steward',
    'tolak tanda plus berulang',
    'POST',
    '/api/persons',
    { fullName: marker, phoneE164: '++6281123456789' },
    400,
  );
  const importPhone = phone.slice(0, -1) + ((Number(phone.slice(-1)) + 3) % 10);
  const importEmail = `csv-${email}`;
  const importedName = `${marker} CSV`;
  const preview = (
    await api(
      'data_steward',
      'validasi impor dan duplikat dalam file',
      'POST',
      '/api/reports/import-csv/dry-run',
      {
        rows: [
          { fullName: importedName, phone: importPhone, email: importEmail },
          { fullName: importedName, phone: importPhone.replace('+62', '0') },
          { fullName: marker, phone },
          { fullName: importedName, phone: '0812abc3456789' },
        ],
      },
    )
  ).data;
  verify(
    'CSV memisahkan baris valid duplikat dan nomor rusak',
    preview.validCount === 1 &&
      preview.duplicateCount === 2 &&
      preview.errorCount === 3,
  );
  const importBody = {
    rows: [
      { fullName: importedName, phoneE164: importPhone, email: importEmail },
    ],
    reason: marker,
  };
  const committed = (
    await api(
      'data_steward',
      'impor jamaah lengkap dengan peran dan audit',
      'POST',
      '/api/reports/import-csv/commit',
      importBody,
      201,
    )
  ).data;
  verify('impor menyimpan satu jamaah', committed.importedCount === 1);
  const imported = (
    await pool.query(
      'SELECT p.id,p.full_name,p.owner_user_id,r.role_code FROM persons p JOIN person_roles r ON r.person_id=p.id WHERE p.email=$1',
      [importEmail],
    )
  ).rows;
  verify(
    'hasil CSV memiliki peran Jamaah dan PIC',
    imported.length === 1 &&
      imported[0].role_code === 'jamaah' &&
      imported[0].owner_user_id ===
        vault.accounts.find((account) => account.role === 'data_steward')!.id,
  );
  const importedList = (
    await api(
      'data_steward',
      'hasil impor tersambung direktori jamaah',
      'GET',
      `/api/persons?search=${encodeURIComponent(importEmail)}&roleCode=jamaah`,
    )
  ).data;
  verify(
    'hasil impor dapat dibuka di People',
    importedList.some((row: any) => row.id === imported[0].id),
  );
  await api(
    'data_steward',
    'impor ulang tidak menimpa identitas',
    'POST',
    '/api/reports/import-csv/commit',
    {
      ...importBody,
      rows: [{ ...importBody.rows[0], fullName: 'Dilarang menimpa' }],
    },
    409,
  );
  verify(
    'kontak lama tidak tertimpa impor',
    (
      await pool.query('SELECT full_name FROM persons WHERE email=$1', [
        importEmail,
      ])
    ).rows[0].full_name === importedName,
  );
  const invalidPhone =
    phone.slice(0, -1) + ((Number(phone.slice(-1)) + 4) % 10);
  await api(
    'data_steward',
    'seluruh batch ditolak sebelum perubahan parsial',
    'POST',
    '/api/reports/import-csv/commit',
    {
      rows: [
        { fullName: importedName, phoneE164: invalidPhone },
        { fullName: importedName, phoneE164: 'nomor-rusak' },
      ],
      reason: marker,
    },
    400,
  );
  verify(
    'batch gagal tidak meninggalkan jamaah parsial',
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM persons WHERE phone_e164=$1',
        [invalidPhone],
      )
    ).rows[0].count === 0,
  );
  const concurrentPhone =
    phone.slice(0, -1) + ((Number(phone.slice(-1)) + 5) % 10);
  const concurrentBody = {
    rows: [{ fullName: `${marker} CSV paralel`, phoneE164: concurrentPhone }],
    reason: marker,
  };
  const concurrent = await Promise.all([
    api(
      'data_steward',
      'impor bersamaan pertama',
      'POST',
      '/api/reports/import-csv/commit',
      concurrentBody,
      [201, 409],
    ),
    api(
      'data_steward',
      'impor bersamaan kedua',
      'POST',
      '/api/reports/import-csv/commit',
      concurrentBody,
      [201, 409],
    ),
  ]);
  verify(
    'dua impor bersamaan hanya membuat satu identitas',
    concurrent.filter((row) => row.data?.importedCount === 1).length === 1 &&
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM persons WHERE phone_e164=$1',
          [concurrentPhone],
        )
      ).rows[0].count === 1,
  );
  console.log(
    JSON.stringify({
      fixture: marker,
      personId,
      checks: checks.length,
      passed: true,
    }),
  );
} catch (error) {
  errorMessage = (error as Error).message;
  console.log(
    JSON.stringify({
      passed: false,
      error: errorMessage,
      checks: checks.length,
    }),
  );
  process.exitCode = 1;
} finally {
  try {
    const current = new Map(
      (await legacyRows()).map((row: any) => [
        `${row.table_name}:${row.row_hash}`,
        row.copies,
      ]),
    );
    const preserved =
      originalRows.length > 0 &&
      originalRows.every(
        (row: any) =>
          Number(current.get(`${row.table_name}:${row.row_hash}`) || 0) >=
          row.copies,
      );
    checks.push({
      feature: 'semua baris lama salinan tetap utuh',
      passed: preserved,
    });
    const report = {
      environment: 'staging',
      checkedAt: new Date().toISOString(),
      marker,
      personId,
      total: checks.length,
      passed: checks.filter((row) => row.passed).length,
      failed: checks.filter((row) => !row.passed).length,
      oldBusinessRowsPreserved: preserved,
      error: errorMessage,
      checks,
      appErrors: [...new Set(appErrors)],
      slowestReads: timings.sort((a, b) => b.ms - a.ms).slice(0, 8),
    };
    saveReport('staging-people-verification.json', report);
    console.log(
      JSON.stringify({
        ...report,
        checks: report.checks.filter((row) => !row.passed),
      }),
    );
    if (report.failed) process.exitCode = 1;
  } finally {
    console.error = originalError;
    const { getDbPool } = await import('../server/db/client');
    await getDbPool().end();
    await pool.end();
  }
}
