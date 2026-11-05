import { retryConnectionRead } from '../server/db/readRetry';
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
  throw new Error('Mutasi Events hanya di staging.');
const vault = readVault('staging');
if (!vault) throw new Error('Vault staging tidak tersedia.');
const pool = prepareEnvironment('staging', vault);
pool.on('error', () => {
  /* A failed idle test connection is replaced by the pool. */
});
process.env.MAILKETING_API_TOKEN = '';
process.env.MAILKETING_API_KEY = '';
const { handler } = await import('../netlify/functions/api');
const marker = `UAT Events ${Date.now().toString(36)}`;
const tokens = new Map<string, string>();
const checks: Array<{ feature: string; passed: boolean; actual?: number }> = [];
const eventIds: string[] = [];
let counter = 0;
const phone = () =>
  `+628${Date.now().toString().slice(-9)}${String(counter++).padStart(3, '0')}`;
function verify(feature: string, value: boolean) {
  checks.push({ feature, passed: value });
  if (!value) throw new Error(feature);
}
async function api(
  feature: string,
  method: string,
  path: string,
  body?: unknown,
  expected: number | number[] = 200,
  role: string | null = 'crm_admin',
) {
  const url = new URL(path, 'http://localhost');
  const response = await handler({
    path: url.pathname,
    httpMethod: method,
    headers: role ? { authorization: `Bearer ${tokens.get(role)}` } : {},
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body === undefined ? null : JSON.stringify(body),
  });
  const json = JSON.parse(response.body || '{}');
  const passed = (Array.isArray(expected) ? expected : [expected]).includes(
    response.statusCode,
  );
  checks.push({ feature, passed, actual: response.statusCode });
  if (!passed)
    throw new Error(
      `${feature}: HTTP ${response.statusCode}; ${json.error?.message || ''}`,
    );
  return json.data;
}
const businessTables = (targets.legacyTables as string[]).filter(
  (table) =>
    ![
      'app_users',
      'audit_logs',
      'rate_limits',
      'kajian_rutin_rate_limits',
    ].includes(table),
);
async function legacyRows() {
  return (
    await pool.query(
      businessTables
        .map(
          (table) =>
            `SELECT '${table}' AS table_name,md5(to_jsonb(r)::text) AS row_hash,count(*)::int AS copies FROM public."${table}" r GROUP BY md5(to_jsonb(r)::text)`,
        )
        .join(' UNION ALL '),
    )
  ).rows;
}
let before: any[] = [];
let errorMessage = '';
try {
  before = await retryConnectionRead(() => legacyRows());
  for (const account of vault.accounts) {
    const login = await api(
      `login ${account.role}`,
      'POST',
      '/api/auth/login',
      { email: account.email, password: account.password },
      200,
      null,
    );
    tokens.set(account.role, login.token);
    const allowed = hasPermission(
      [account.role as RoleCode],
      PERMISSIONS.EVENTS_VIEW,
    );
    await api(
      `direktori ${account.role}`,
      'GET',
      '/api/events',
      undefined,
      allowed ? 200 : 403,
      account.role,
    );
  }
  await api('anonim ditolak', 'GET', '/api/events', undefined, 401, null);
  const base = {
    title: marker,
    speaker: 'Pemateri Uji',
    category: 'Daurah Khusus',
    startAt: new Date(Date.now() + 86400000 * 8).toISOString(),
    endAt: new Date(Date.now() + 86400000 * 8 + 7200000).toISOString(),
    deliveryMode: 'offline',
    targetAudience: 'umum',
    locationName: 'Lokasi Uji Staging',
    quota: 100,
    isRegistrationOpen: true,
  };
  await api(
    'tanggal tidak valid ditolak',
    'POST',
    '/api/events',
    { ...base, startAt: 'invalid' },
    400,
  );
  await api(
    'urutan jadwal ditolak',
    'POST',
    '/api/events',
    { ...base, endAt: '2020-01-01T00:00:00Z' },
    400,
  );
  await api(
    'event berbayar nol ditolak',
    'POST',
    '/api/events',
    { ...base, isPaid: true, priceRupiah: 0 },
    400,
  );
  const paid = await api(
    'buat event berbayar',
    'POST',
    '/api/events',
    {
      ...base,
      isPaid: true,
      priceRupiah: 50000,
      formConfig: {
        customFields: [{ id: 'note', label: 'Catatan', type: 'text' }],
        emailNotifications: {
          registrationTicketEnabled: false,
          reminderEnabled: false,
        },
        customSibling: { keep: true },
      },
    },
    201,
  );
  eventIds.push(paid.id);
  const manual = await api(
    'manual berbayar',
    'POST',
    `/api/events/${paid.id}/participants/manual`,
    {
      fullName: '=HYPERLINK("uji")',
      phone: phone(),
      gender: 'akhwat',
      age: 30,
      email: `${Date.now()}@example.test`,
    },
    201,
    'event_admin',
  );
  verify(
    'pembayaran manual pending',
    manual.attendance.paymentStatus === 'pending_payment' &&
      manual.attendance.paymentAmountRupiah === 50000,
  );
  const profile = (
    await pool.query(
      'SELECT p.owner_user_id, r.role_code FROM persons p LEFT JOIN person_roles r ON r.person_id=p.id WHERE p.id=$1',
      [manual.person.id],
    )
  ).rows;
  verify(
    'profil jamaah dan PIC terhubung',
    Boolean(profile[0]?.owner_user_id) &&
      profile.some((row: any) => row.role_code === 'jamaah'),
  );
  await api(
    'manual duplikat ditolak',
    'POST',
    `/api/events/${paid.id}/participants/manual`,
    { fullName: 'Duplikat Peserta', phone: manual.person.phoneE164 },
    409,
  );
  const invalidPhone = phone();
  await api(
    'telepon invalid ditolak',
    'POST',
    `/api/events/${paid.id}/participants/manual`,
    { fullName: 'Invalid Phone', phone: `abc${invalidPhone}` },
    400,
  );
  for (const path of ['toggle-attendance', 'attendance'])
    await api(
      `pending diblokir ${path}`,
      'POST',
      `/api/events/${paid.id}/${path}`,
      path === 'attendance'
        ? { personId: manual.person.id }
        : { attendanceId: manual.attendance.id },
      400,
    );
  await api(
    'scanner pending ditolak',
    'POST',
    `/api/events/${paid.id}/attendances/scan`,
    { ticketCode: manual.ticketCode },
    400,
  );
  const bulk = await api(
    'bulk pending dilewati',
    'POST',
    `/api/events/${paid.id}/attendances/bulk-checkin`,
    { attendanceIds: [manual.attendance.id], status: 'attended' },
  );
  verify('bulk tidak menerobos pembayaran', bulk.updatedCount === 0);
  const importedPhone = phone(),
    rejectedPhone = phone();
  const imported = await api(
    'CSV campuran',
    'POST',
    `/api/events/${paid.id}/import-participants`,
    {
      participants: [
        {
          fullName: 'Peserta CSV Berbayar',
          phone: importedPhone,
          gender: 'ikhwan',
          ticketCode: `YTS-UAT-${Date.now()}`,
          registrationData: {
            note: '=CSV',
            registrationChannel: 'staff_yayasan',
          },
        },
        {
          fullName: 'Presensi Bayar Ditolak',
          phone: rejectedPhone,
          status: 'attended',
        },
        { fullName: 'Duplikat CSV', phone: importedPhone },
      ],
    },
  );
  verify(
    'CSV pending, duplikat dilewati, hadir ditolak',
    imported.importedCount === 1 &&
      imported.skippedCount === 1 &&
      imported.errorCount === 1,
  );
  verify(
    'baris gagal tidak meninggalkan profil',
    Number(
      (
        await pool.query(
          'SELECT count(*)::int n FROM persons WHERE phone_e164=$1',
          [rejectedPhone],
        )
      ).rows[0].n,
    ) === 0,
  );
  let detail = await api('roster terhubung', 'GET', `/api/events/${paid.id}`);
  const csvRow = detail.participants.find(
    (row: any) => row.personPhone === importedPhone,
  );
  verify(
    'CSV tidak dapat memalsukan pembebasan staf',
    csvRow.paymentStatus === 'pending_payment' &&
      !csvRow.isStaffRegistration &&
      csvRow.registrationData.note === '=CSV',
  );
  const exported = await api(
    'ekspor filter peserta',
    'POST',
    `/api/events/${paid.id}/participants/export`,
    { attendanceIds: [manual.attendance.id, csvRow.id] },
  );
  verify(
    'CSV aman rumus dan tidak mengekspos bukti',
    exported.count === 2 &&
      exported.csvContent.includes("'=") &&
      exported.csvContent.includes('Form: Catatan') &&
      !exported.csvContent.includes('Bukti URL'),
  );
  const virtualPhone = manual.person.phoneE164 + '-fam-2';
  await pool.query('UPDATE persons SET phone_e164=$1 WHERE id=$2', [
    virtualPhone,
    manual.person.id,
  ]);
  const edit = await api(
    'edit nama keluarga menjaga nomor virtual',
    'PATCH',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}`,
    {
      fullName: 'Peserta Keluarga Uji',
      phone: virtualPhone,
      email: manual.person.email || '',
      cityRegency: '',
    },
  );
  verify(
    'nomor virtual dan tiket tetap utuh',
    edit.participant.personPhone === virtualPhone &&
      edit.participant.ticketCode === manual.ticketCode,
  );
  await api(
    'edit kontak berhuruf ditolak',
    'PATCH',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}`,
    {
      fullName: 'Peserta Keluarga Uji',
      phone: 'abc123456789',
      email: '',
      cityRegency: '',
    },
    400,
  );
  const restored = await api(
    'koreksi nomor keluarga secara eksplisit',
    'PATCH',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}`,
    {
      fullName: manual.person.fullName,
      phone: manual.person.phoneE164,
      email: manual.person.email || '',
      cityRegency: '',
    },
  );
  verify(
    'koreksi kontak menjaga identitas tiket',
    restored.participant.ticketCode === manual.ticketCode &&
      restored.participant.personPhone === manual.person.phoneE164,
  );
  await api(
    'kontak tidak mengambil profil lain',
    'PATCH',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}`,
    {
      fullName: 'Konflik Kontak Uji',
      phone: importedPhone,
      email: '',
      cityRegency: '',
    },
    409,
  );
  await pool.query(
    "UPDATE event_attendance SET payment_status='free' WHERE id=$1",
    [manual.attendance.id],
  );
  detail = await api(
    'deteksi pembayaran lama ambigu',
    'GET',
    `/api/events/${paid.id}`,
  );
  verify(
    'status lama ditandai tanpa diubah',
    detail.paymentReviewCount === 1 &&
      detail.participants.find((row: any) => row.id === manual.attendance.id)
        .paymentStatus === 'free',
  );
  await api(
    'legacy free tidak menerobos checkin',
    'POST',
    `/api/events/${paid.id}/toggle-attendance`,
    { attendanceId: manual.attendance.id },
    400,
  );
  await api(
    'gate publik memblokir legacy free',
    'POST',
    `/api/public/gate/events/${paid.id}/scan?access=${encodeURIComponent(paid.formConfig.gateAccessToken)}`,
    { ticketCode: manual.ticketCode },
    400,
    null,
  );
  await api(
    'toggle gate publik memblokir legacy free',
    'POST',
    `/api/public/gate/events/${paid.id}/toggle-checkin?access=${encodeURIComponent(paid.formConfig.gateAccessToken)}`,
    { attendanceId: manual.attendance.id, targetStatus: 'attended' },
    400,
    null,
  );
  await api(
    'legacy free tidak dihapus',
    'DELETE',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}`,
    undefined,
    409,
  );
  await api(
    'verifikasi pembayaran',
    'POST',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}/verify-payment`,
  );
  await api(
    'hadir setelah verifikasi',
    'POST',
    `/api/events/${paid.id}/toggle-attendance`,
    { attendanceId: manual.attendance.id },
  );
  await api(
    'verifikasi ulang menjaga hadir',
    'POST',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}/verify-payment`,
  );
  detail = await api(
    'riwayat hadir tersimpan',
    'GET',
    `/api/events/${paid.id}`,
  );
  verify(
    'verifikasi tidak mereset presensi',
    detail.attendedCount === 1 &&
      Boolean(
        detail.participants.find((row: any) => row.id === manual.attendance.id)
          .checkInAt,
      ),
  );
  await api(
    'hadir tidak dihapus',
    'DELETE',
    `/api/events/${paid.id}/attendances/${manual.attendance.id}`,
    undefined,
    409,
  );
  await pool.query(
    'UPDATE event_attendance SET registration_group_id=$1 WHERE id=ANY($2::uuid[])',
    [`UAT-${marker}`, [manual.attendance.id, csvRow.id]],
  );
  await api(
    'grup campuran dengan riwayat tidak dihapus',
    'DELETE',
    `/api/events/${paid.id}/attendances/${csvRow.id}?deleteGroup=true`,
    undefined,
    409,
  );
  await api(
    'hapus massal campuran atomik ditolak',
    'POST',
    `/api/events/${paid.id}/attendances/bulk-delete`,
    { attendanceIds: [manual.attendance.id, csvRow.id] },
    409,
  );
  verify(
    'semua anggota grup tetap ada',
    Number(
      (
        await pool.query(
          'SELECT count(*)::int n FROM event_attendance WHERE event_id=$1',
          [paid.id],
        )
      ).rows[0].n,
    ) === 2,
  );
  await api(
    'event berisi data tidak dihapus',
    'DELETE',
    `/api/events/${paid.id}`,
    undefined,
    409,
  );
  await api('patch pengaturan saudara', 'PUT', `/api/events/${paid.id}`, {
    formConfig: { emailNotifications: { reminderEnabled: true } },
  });
  const settings = await api(
    'pengaturan ringkas',
    'GET',
    `/api/events/${paid.id}/settings`,
  );
  verify(
    'patch mempertahankan sibling, gate, custom fields',
    settings.formConfig.gateAccessToken === paid.formConfig.gateAccessToken &&
      settings.formConfig.customSibling.keep &&
      settings.formConfig.emailNotifications.registrationTicketEnabled ===
        false &&
      settings.formConfig.emailNotifications.reminderEnabled === true &&
      settings.formConfig.customFields.length === 1,
  );
  verify(
    'pengaturan tidak mengunduh roster',
    settings.participants.length === 0 && settings.totalParticipants === 2,
  );
  await api('batalkan event menjaga data', 'PUT', `/api/events/${paid.id}`, {
    status: 'cancelled',
    isRegistrationOpen: true,
  });
  await api(
    'event batal tidak dapat dibuka tanpa perubahan status',
    'PUT',
    `/api/events/${paid.id}`,
    { isRegistrationOpen: true, isStaffRegistrationOpen: true },
  );
  const cancelled = await api(
    'status batal',
    'GET',
    `/api/events/${paid.id}/settings`,
  );
  verify(
    'pembatalan menutup semua pendaftaran',
    cancelled.status === 'cancelled' &&
      !cancelled.isRegistrationOpen &&
      !cancelled.isStaffRegistrationOpen &&
      cancelled.totalParticipants === 2,
  );
  await api(
    'pendaftaran event batal ditolak',
    'POST',
    `/api/events/${paid.id}/participants/manual`,
    { fullName: 'Terlambat Batal', phone: phone() },
    400,
  );
  const empty = await api(
    'buat jadwal kosong',
    'POST',
    '/api/events',
    { ...base, title: `${marker} kosong` },
    201,
  );
  await api('hapus jadwal kosong aman', 'DELETE', `/api/events/${empty.id}`);
  const cap = await api(
    'buat event kuota satu',
    'POST',
    '/api/events',
    { ...base, title: `${marker} kuota`, quota: 1 },
    201,
  );
  eventIds.push(cap.id);
  const racePhone1 = phone(),
    racePhone2 = phone();
  const race = await Promise.all([
    api(
      'race manual',
      'POST',
      `/api/events/${cap.id}/participants/manual`,
      { fullName: 'Peserta Race Manual', phone: racePhone1 },
      [201, 400],
    ),
    api(
      'race publik',
      'POST',
      '/api/public/register-event',
      {
        eventId: cap.id,
        fullName: 'Peserta Race Publik',
        phone: racePhone2,
        gender: 'ikhwan',
        agreedToRules: true,
      },
      [200, 400],
      null,
    ),
  ]);
  const count = await pool.query(
    'SELECT count(*)::int n FROM event_attendance WHERE event_id=$1',
    [cap.id],
  );
  verify('manual dan publik berbagi satu slot', count.rows[0].n === 1);
  verify(
    'race kuota tidak meninggalkan profil yatim',
    Number(
      (
        await pool.query(
          'SELECT count(*)::int n FROM persons WHERE phone_e164=ANY($1::text[])',
          [[racePhone1, racePhone2]],
        )
      ).rows[0].n,
    ) === 1,
  );
  const genderEvent = await api(
    'event khusus akhwat',
    'POST',
    '/api/events',
    {
      ...base,
      title: `${marker} akhwat`,
      targetAudience: 'akhwat_only',
      minAge: 18,
      motorcycleParkingQuota: 1,
    },
    201,
  );
  eventIds.push(genderEvent.id);
  await api(
    'segmentasi manual ditegakkan',
    'POST',
    `/api/events/${genderEvent.id}/participants/manual`,
    { fullName: 'Ikhwan Uji', phone: phone(), gender: 'ikhwan', age: 25 },
    400,
  );
  await api(
    'usia manual ditegakkan',
    'POST',
    `/api/events/${genderEvent.id}/participants/manual`,
    { fullName: 'Akhwat Muda Uji', phone: phone(), gender: 'akhwat', age: 12 },
    400,
  );
  const free = await api(
    'manual akhwat valid',
    'POST',
    `/api/events/${genderEvent.id}/participants/manual`,
    {
      fullName: 'Akhwat Uji',
      phone: phone(),
      gender: 'akhwat',
      age: 25,
      vehicleType: 'motorcycle',
    },
    201,
  );
  await api(
    'parkir CSV ditegakkan',
    'POST',
    `/api/events/${genderEvent.id}/import-participants`,
    {
      participants: [
        {
          fullName: 'Akhwat Parkir Uji',
          phone: phone(),
          gender: 'akhwat',
          age: 25,
          vehicleType: 'motorcycle',
        },
      ],
    },
  ).then((result) =>
    verify(
      'parkir penuh menghasilkan error per baris',
      result.importedCount === 0 && result.errorCount === 1,
    ),
  );
  await api(
    'hapus pendaftaran tanpa riwayat',
    'DELETE',
    `/api/events/${genderEvent.id}/attendances/${free.attendance.id}`,
  );
  await api(
    'aktifkan bazar',
    'POST',
    `/api/events/${genderEvent.id}/bazaar`,
    { title: marker, defaultFeeRupiah: 0 },
    200,
    'event_admin',
  );
  await api(
    'buat stan',
    'POST',
    `/api/events/${genderEvent.id}/bazaar/booths/bulk`,
    { booths: [{ code: 'UAT-01', name: 'Stan UAT', priceRupiah: 0 }] },
    200,
    'event_admin',
  );
  const bazaar = (
    await pool.query('SELECT id FROM bazaar_events WHERE event_id=$1', [
      genderEvent.id,
    ])
  ).rows[0];
  const booth = (
    await pool.query('SELECT id FROM bazaar_booths WHERE bazaar_id=$1', [
      bazaar.id,
    ])
  ).rows[0];
  const applied = await api(
    'tenant mendaftar publik',
    'POST',
    `/api/public/events/${genderEvent.id}/bazaar/apply`,
    {
      brandName: marker,
      businessCategory: 'kuliner',
      picName: 'Tenant Uji',
      picPhone: free.person.phoneE164,
      productDescription: 'Produk uji staging',
    },
    200,
    null,
  );
  const applicationId = applied.application.id;
  verify(
    'tenant terhubung ke Jamaah',
    applied.tenant.personId === free.person.id,
  );
  for (const [feature, method, suffix, body] of [
    [
      'status tenant lintas event ditolak',
      'PUT',
      `applications/${applicationId}/status`,
      { status: 'accepted' },
    ],
    [
      'biaya tenant lintas event ditolak',
      'PUT',
      `applications/${applicationId}/fee`,
      { infaqAmountRupiah: 0 },
    ],
    [
      'penempatan lintas event ditolak',
      'PUT',
      `applications/${applicationId}/assign-booth`,
      { boothId: booth.id },
    ],
    [
      'checkin tenant lintas event ditolak',
      'POST',
      'check-in',
      { applicationId },
    ],
    [
      'insiden lintas event ditolak',
      'POST',
      'incidents',
      { applicationId, category: 'operasional', description: marker },
    ],
    [
      'evaluasi lintas event ditolak',
      'POST',
      'evaluations',
      { applicationId, internalNotes: marker },
    ],
    [
      'edit stan lintas event ditolak',
      'PUT',
      `booths/${booth.id}`,
      { name: 'Tidak boleh berubah' },
    ],
    [
      'hapus stan lintas event ditolak',
      'DELETE',
      `booths/${booth.id}`,
      undefined,
    ],
  ] as const)
    await api(
      feature,
      method,
      `/api/events/${cap.id}/bazaar/${suffix}`,
      body,
      404,
      'event_admin',
    );
  await api(
    'terima tenant pada event yang benar',
    'PUT',
    `/api/events/${genderEvent.id}/bazaar/applications/${applicationId}/status`,
    { status: 'accepted' },
    200,
    'event_admin',
  );
  await api(
    'tempatkan tenant',
    'PUT',
    `/api/events/${genderEvent.id}/bazaar/applications/${applicationId}/assign-booth`,
    { boothId: booth.id, isPublished: true },
    200,
    'event_admin',
  );
  await api(
    'stan dengan riwayat tidak dihapus',
    'DELETE',
    `/api/events/${genderEvent.id}/bazaar/booths/${booth.id}`,
    undefined,
    409,
    'event_admin',
  );
  await api(
    'checkin tenant',
    'POST',
    `/api/events/${genderEvent.id}/bazaar/check-in`,
    { applicationId },
    200,
    'event_admin',
  );
  await api(
    'catat insiden tenant',
    'POST',
    `/api/events/${genderEvent.id}/bazaar/incidents`,
    { applicationId, category: 'operasional', description: marker },
    200,
    'event_admin',
  );
  await api(
    'evaluasi tenant',
    'POST',
    `/api/events/${genderEvent.id}/bazaar/evaluations`,
    { applicationId, internalNotes: marker },
    200,
    'event_admin',
  );
  const tenantProfile = await api(
    'profil tenant lintas event',
    'GET',
    `/api/bazaar/tenants/${applied.tenant.id}`,
    undefined,
    200,
    'event_admin',
  );
  verify(
    'riwayat tenant, stan, dan event terhubung',
    JSON.stringify(tenantProfile).includes(applicationId),
  );
  for (const suffix of ['incidents', 'surveys'])
    await api(
      `rekap bazar ${suffix}`,
      'GET',
      `/api/events/${genderEvent.id}/bazaar/${suffix}`,
      undefined,
      200,
      'event_admin',
    );
  await api(
    'event berisi bazar tidak dihapus',
    'DELETE',
    `/api/events/${genderEvent.id}`,
    undefined,
    409,
  );
  const bazaarDetail = await api(
    'rekap evaluasi di panel bazar',
    'GET',
    `/api/events/${genderEvent.id}/bazaar`,
    undefined,
    200,
    'event_admin',
  );
  verify(
    'evaluasi terhubung pada aplikasi tenant yang benar',
    bazaarDetail.bazaar.applications.some(
      (item: any) =>
        item.id === applicationId && item.evaluation?.internalNotes === marker,
    ),
  );
  const audit = await pool.query(
    "SELECT DISTINCT action FROM audit_logs WHERE entity_id=ANY($1::uuid[]) OR after_json->>'eventId'=ANY($1::text[])",
    [[paid.id, cap.id, manual.attendance.id, csvRow.id]],
  );
  verify(
    'audit pembayaran, pengaturan, ekspor terhubung',
    ['verify_event_payment', 'update_event', 'export_event_participants'].every(
      (action) => audit.rows.some((row: any) => row.action === action),
    ),
  );
} catch (error) {
  errorMessage = (error as Error).message;
  process.exitCode = 1;
} finally {
  const after = new Map(
    (await retryConnectionRead(() => legacyRows()).catch(() => [])).map(
      (row: any) => [`${row.table_name}:${row.row_hash}`, row.copies],
    ),
  );
  const preserved =
    before.length > 0 &&
    before.every(
      (row: any) =>
        Number(after.get(`${row.table_name}:${row.row_hash}`) || 0) >=
        row.copies,
    );
  checks.push({
    feature: 'seluruh baris bisnis lama tetap utuh',
    passed: preserved,
  });
  const report = {
    environment: 'staging',
    at: new Date().toISOString(),
    marker,
    eventIds,
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    oldBusinessRowsPreserved: preserved,
    error: errorMessage,
    checks,
  };
  saveReport('staging-events-verification.json', report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((row) => !row.passed) }),
  );
  if (report.failed) process.exitCode = 1;
  const { getDbPool } = await import('../server/db/client');
  await getDbPool().end();
  await pool.end();
}
