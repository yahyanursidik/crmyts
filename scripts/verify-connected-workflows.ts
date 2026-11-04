import { randomBytes } from 'node:crypto';
import { prepareEnvironment, readVault, saveReport, targets } from './access-runtime';

// This script deliberately refuses the production database: all mutations are UAT fixtures.
if (process.argv[process.argv.indexOf('--environment') + 1] !== 'staging') throw new Error('Uji transaksi hanya boleh di branch staging.');
const vault = readVault('staging');
if (!vault) throw new Error('Vault staging tidak tersedia.');
const pool = prepareEnvironment('staging', vault);
process.env.MAILKETING_API_TOKEN = '';
const { handler } = await import('../netlify/functions/api');
const run = Date.now().toString(36);
const marker = `UAT YTS ${run}`;
const tokens = new Map<string, string>();
const checks: Array<{ feature: string; passed: boolean; expected?: number; actual?: number; error?: string }> = [];
const appErrors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const error = args.find((arg) => arg instanceof Error) as Error | undefined;
  appErrors.push(String((error as any)?.cause?.message || error?.message || args[0]).split('\n')[0].slice(0, 250));
};
function verify(feature: string, value: unknown) {
  checks.push({ feature, passed: value === true });
  if (value !== true) throw new Error(feature);
}
async function api(role: string | null, feature: string, method: string, path: string, body?: unknown, expected = 200, extraHeaders = {}) {
  const url = new URL(path, 'http://localhost');
  const result = await handler({ path: url.pathname, httpMethod: method, headers: { ...(role ? { authorization: `Bearer ${tokens.get(role)}` } : {}), ...extraHeaders }, queryStringParameters: Object.fromEntries(url.searchParams), body: body === undefined ? null : JSON.stringify(body) });
  const payload = JSON.parse(result.body || '{}');
  checks.push({ feature, passed: result.statusCode === expected, expected, actual: result.statusCode, ...(result.statusCode !== expected ? { error: payload.error?.message || 'Status tidak sesuai' } : {}) });
  if (result.statusCode !== expected) throw new Error(`${feature}: ${result.statusCode} (expected ${expected})`);
  return payload.data;
}
async function scenario(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(JSON.stringify({ scenario: name, passed: true })); }
  catch (error) { console.log(JSON.stringify({ scenario: name, passed: false, error: (error as Error).message })); }
}
async function legacyRows() {
  const tables = (targets.legacyTables as string[]).filter((name) => !['app_users', 'audit_logs', 'rate_limits', 'kajian_rutin_rate_limits'].includes(name));
  return (await pool.query(tables.map((name) => `SELECT '${name}' AS table_name, md5(to_jsonb(r)::text) AS row_hash, count(*)::int AS copies FROM public."${name}" r GROUP BY md5(to_jsonb(r)::text)`).join(' UNION ALL '))).rows;
}

let personId = '', eventId = '', waqfId = '';
const fixturePhone = `+628${Date.now().toString().slice(-11)}`;
const future = new Date(Date.now() + 86400000);
const dueAt = new Date(Date.now() + 3 * 86400000).toISOString();
const fixtureEmail = `uat-${run}@example.test`;
try {
  const originalRows = await legacyRows();
  for (const account of vault.accounts) {
    const login = await api(null, `login ${account.role}`, 'POST', '/api/auth/login', { email: account.email, password: account.password });
    tokens.set(account.role, login.token);
  }
  await scenario('jamaah dan kualitas data', async () => {
    const created = await api('data_steward', 'buat jamaah', 'POST', '/api/persons', { fullName: marker, phoneE164: fixturePhone, gender: 'ikhwan', cityRegency: 'Kota Uji', sourceCode: 'UAT' }, 201);
    personId = created.id;
    await api('data_steward', 'ubah jamaah', 'PUT', `/api/persons/${personId}`, { occupation: 'Uji keterhubungan sistem' });
    const duplicate = await api('data_steward', 'deteksi duplikat', 'GET', `/api/persons/check-duplicate?phone=${encodeURIComponent(fixturePhone)}`);
    verify('duplikat mengarah profil yang sama', duplicate.candidates.some((row: any) => row.id === personId));
    await api('broadcast_officer', 'proteksi profil jamaah', 'GET', `/api/persons/${personId}`, undefined, 403);
  });
  await scenario('event keluarga, tiket, presensi dan laporan', async () => {
    const event = await api('event_admin', 'buat event', 'POST', '/api/events', { title: marker, category: 'Kajian', speaker: 'Ustadz Pengujian', startAt: future.toISOString(), endAt: new Date(future.getTime() + 7200000).toISOString(), quota: 10, formConfig: { allowMultiParticipant: true, maxMultiParticipants: 4, requireGender: true, emailSettings: { registrationTicketEnabled: false } } }, 201);
    eventId = event.id;
    const registrationBody = { eventId, fullName: marker, phone: fixturePhone, gender: 'ikhwan', age: 35, cityRegency: 'Kota Uji', additionalParticipants: [{ fullName: `${marker} Keluarga`, gender: 'akhwat', age: 30, relationship: 'Istri' }] };
    const registered = await api(null, 'pendaftaran keluarga publik', 'POST', '/api/public/register-event', registrationBody);
    verify('tiket keluarga lengkap', registered.totalParticipantsCount === 2 && Boolean(registered.ticketCode));
    const ticket = await api(null, 'portal tiket peserta', 'POST', '/api/public/participant-ticket', { eventId, ticketCode: registered.ticketCode, phone: fixturePhone });
    verify('tiket terhubung ke event', ticket.event.id === eventId);
    const scanned = await api('event_admin', 'scan tiket', 'POST', `/api/events/${eventId}/attendances/scan`, { ticketCode: registered.ticketCode });
    verify('presensi tercatat', scanned.checkedInNow === true);
    const again = await api('event_admin', 'scan ulang idempoten', 'POST', `/api/events/${eventId}/attendances/scan`, { ticketCode: registered.ticketCode });
    verify('tidak menggandakan presensi', again.alreadyCheckedIn === true);
    const detail = await api('event_admin', 'daftar peserta event', 'GET', `/api/events/${eventId}`);
    verify('rekap peserta keluarga benar', detail.totalParticipants === 2 && detail.attendedCount === 1);
    const profile = await api('crm_admin', 'profil 360 event', 'GET', `/api/persons/${personId}`);
    verify('riwayat event di profil jamaah', JSON.stringify(profile).includes(eventId));
    const reports = await api('event_admin', 'laporan presensi', 'GET', '/api/reports/attendance-summary?limit=100');
    verify('event muncul di laporan', JSON.stringify(reports).includes(eventId));
    await api('cs_officer', 'CS tidak mengubah event', 'PUT', `/api/events/${eventId}`, { title: 'Dilarang' }, 403);
    await api(null, 'gate tanpa kunci ditolak', 'GET', `/api/public/gate/events/${eventId}`, undefined, 403);
    const key = await api('event_admin', 'tautan privat gate', 'GET', `/api/events/${eventId}/gate-access`);
    await api(null, 'gate dengan kunci', 'GET', `/api/public/gate/events/${eventId}`, undefined, 200, { 'x-gate-access': key.gateAccessToken });
    const publicDetail = await api(null, 'form pendaftaran publik', 'GET', `/api/public/events/${eventId}`);
    verify('kunci gate tidak bocor ke pendaftaran', !JSON.stringify(publicDetail).includes(key.gateAccessToken));
  });
  await scenario('interaksi, penugasan dan isolasi staf', async () => {
    const result = await api('cs_officer', 'interaksi dengan tindak lanjut', 'POST', '/api/interactions', { personId, channel: 'phone_call', summary: `${marker} konsultasi`, outcome: 'minta_dihubungi_kembali', nextAction: 'Hubungi kembali', taskDueAt: dueAt }, 201);
    const taskId = result.createdTask?.id || result.task?.id;
    verify('tugas otomatis tercipta', Boolean(taskId));
    const owned = await api('cs_officer', 'daftar tugas CS', 'GET', '/api/tasks?page=1&pageSize=100');
    verify('tugas milik CS tampil', owned.some((row: any) => row.id === taskId));
    const others = await api('fundraising_officer', 'isolasi daftar tugas', 'GET', '/api/tasks?page=1&pageSize=100');
    verify('tugas CS tersembunyi dari staf lain', !others.some((row: any) => row.id === taskId));
    await api('fundraising_officer', 'isolasi perubahan tugas', 'PATCH', `/api/tasks/${taskId}/status`, { status: 'completed' }, 404);
    await api('cs_officer', 'selesaikan tugas', 'PATCH', `/api/tasks/${taskId}/status`, { status: 'completed' });
    const target = vault.accounts.find((account) => account.role === 'fundraising_officer')!;
    await api('cs_officer', 'tolak delegasi tanpa izin', 'POST', '/api/tasks', { title: marker, dueAt, ownerUserId: target.id }, 403);
    await api('crm_admin', 'delegasi admin', 'POST', '/api/tasks', { title: marker, dueAt, personId, ownerUserId: target.id }, 201);
    await api('cs_officer', 'pencarian interaksi jamaah', 'GET', `/api/interactions?search=${encodeURIComponent(marker)}`);
  });
  await scenario('donasi, verifikasi, donatur dan ekspor', async () => {
    const [program] = (await pool.query('SELECT id FROM donation_programs WHERE is_active = true LIMIT 1')).rows;
    const donation = await api('fundraising_officer', 'catat donasi', 'POST', '/api/donations', { personId, programId: program.id, amountRupiah: 125000, donationDate: new Date().toISOString(), paymentMethod: 'bank_transfer', externalReference: marker }, 201);
    await api('fundraising_officer', 'fundraising tidak verifikasi sendiri', 'POST', `/api/donations/${donation.id}/verify`, { reason: marker }, 403);
    const verified = await api('finance_verifier', 'verifikasi keuangan', 'POST', `/api/donations/${donation.id}/verify`, { reason: marker });
    verify('status keuangan sah', verified.verificationStatus === 'verified' && Boolean(verified.verifiedBy));
    const donors = await api('fundraising_officer', 'master donatur', 'GET', '/api/donors');
    verify('donasi otomatis membentuk relasi donatur', donors.some((row: any) => row.id === personId));
    await api('fundraising_officer', 'transisi relasi donatur', 'POST', `/api/donors/${personId}/transition-stage`, { targetStage: 'contacted', reason: marker, createTask: true });
    const reconciliation = await api('finance_verifier', 'rekonsiliasi donasi', 'GET', `/api/reports/donations-reconciliation?search=${encodeURIComponent(marker)}`);
    verify('donasi terhubung laporan', JSON.stringify(reconciliation).includes(donation.id));
    const csv = await api('finance_verifier', 'ekspor CSV nyata', 'POST', '/api/reports/export-csv', { reportType: 'donations_reconciliation', reason: marker });
    verify('CSV berisi isi dan baris aktual', Boolean(csv.csvContent) && (csv.rowCount > 0));
    const profile = await api('crm_admin', 'profil 360 donasi', 'GET', `/api/persons/${personId}`);
    verify('donasi terhubung profil', JSON.stringify(profile).includes(donation.id));
  });
  await scenario('wakaf, dokumen, checklist dan tugas', async () => {
    const waqf = await api('waqf_officer', 'buat kasus wakaf', 'POST', '/api/waqf', { personId, waqfType: 'uang', estimatedValueRupiah: 1000000, notesSummary: marker }, 201);
    waqfId = waqf.id;
    const moved = await api('waqf_officer', 'transisi wakaf', 'POST', `/api/waqf/${waqfId}/transition`, { toStage: 'consulted', reason: marker, nextAction: 'Lengkapi berkas', taskDueAt: dueAt });
    verify('tahap dan tindak lanjut wakaf tersambung', moved.currentStage === 'consulted' && Boolean(moved.createdTask?.id));
    const checklist = (await pool.query('SELECT id FROM waqf_checklist_items WHERE waqf_case_id = $1 LIMIT 1', [waqfId])).rows[0];
    verify('checklist wakaf tersedia', Boolean(checklist));
    await api('waqf_officer', 'centang kelengkapan', 'PATCH', `/api/waqf/${waqfId}/checklist/${checklist.id}`, { isCompleted: true });
    await api('waqf_officer', 'daftar dokumen', 'GET', `/api/waqf/${waqfId}/documents`);
    const profile = await api('waqf_officer', 'profil 360 wakaf', 'GET', `/api/persons/${personId}`);
    verify('wakaf terhubung profil jamaah', JSON.stringify(profile).includes(waqfId));
  });
  await scenario('unggah dokumen, akses privat dan relasi wakaf', async () => {
    let file: any;
    try {
      file = await api('waqf_officer', 'unggah dokumen ke penyimpanan nyata', 'POST', '/api/attachments/upload', { originalFilename: `uat-${run}.png`, mimeType: 'image/png', sensitivityLevel: 'restricted', base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jauoAAAAASUVORK5CYII=' }, 201);
      await api('waqf_officer', 'hubungkan lampiran wakaf', 'POST', `/api/waqf/${waqfId}/documents`, { attachmentId: file.id, documentType: 'dokumen_pengujian', isSensitive: true }, 201);
      await api('broadcast_officer', 'tolak akses dokumen lintas peran', 'GET', `/api/attachments/${file.id}/url`, undefined, 403);
      const download = await api('waqf_officer', 'URL dokumen sementara', 'GET', `/api/attachments/${file.id}/url`);
      const signed = await fetch(download.url);
      verify('berkas dapat diunduh dengan URL sementara', signed.status === 200 && (await signed.arrayBuffer()).byteLength === file.fileSize);
      const unsigned = new URL(download.url); unsigned.search = '';
      const publicAttempt = await fetch(unsigned);
      verify('dokumen tidak terbuka tanpa tanda tangan', [401, 403, 404].includes(publicAttempt.status));
      const docs = await api('waqf_officer', 'dokumen tampil pada kasus wakaf', 'GET', `/api/waqf/${waqfId}/documents`);
      verify('metadata dan tautan dokumen terhubung', docs.some((row: any) => row.attachmentId === file.id && Boolean(row.signedUrl)));
    } finally {
      if (file?.objectKey?.startsWith('vault/') && file.originalFilename === `uat-${run}.png`) {
        const { defaultAttachmentService } = await import('../server/storage/service');
        await defaultAttachmentService.getProvider().deleteObject({ bucket: file.bucket, key: file.objectKey });
        await api('waqf_officer', 'arsipkan lampiran sintetis setelah uji', 'DELETE', `/api/attachments/${file.id}`, { reason: marker });
      }
    }
  });
  await scenario('ruang jamaah dan tindak lanjut CS', async () => {
    await api(null, 'pesan jamaah publik', 'POST', '/api/public/jamaah-room', { category: 'pertanyaan', eventId, subject: marker, message: `${marker} mohon informasi jadwal kegiatan yayasan.`, name: marker }, 201);
    const [entry] = (await pool.query('SELECT id FROM jamaah_room_entries WHERE subject = $1', [marker])).rows;
    await api('cs_officer', 'baca pesan jamaah', 'GET', `/api/jamaah-room/${entry.id}`);
    await api('cs_officer', 'tanggapi pesan', 'PATCH', `/api/jamaah-room/${entry.id}`, { status: 'responded', response: 'Jadwal tersedia pada portal kegiatan.' });
    const stored = (await pool.query('SELECT status, response FROM jamaah_room_entries WHERE id = $1', [entry.id])).rows[0];
    verify('tanggapan tersimpan dan terkait event', stored.status === 'responded' && Boolean(stored.response));
  });
  await scenario('kajian rutin dan profil jamaah', async () => {
    const series = await api('event_admin', 'buat seri kajian', 'POST', '/api/kajian-rutin/series', { title: marker, speaker: 'Ustadz Pengujian', dayOfWeek: future.getUTCDay(), startTime: '09:00', endTime: '11:00' }, 201);
    const session = await api('event_admin', 'buat sesi rutin', 'POST', `/api/kajian-rutin/series/${series.id}/sessions`, { sessionDate: future.toISOString().slice(0, 10), topic: marker }, 201);
    const attendance = await api('event_admin', 'presensi manual rutin', 'POST', `/api/kajian-rutin/sessions/${session.id}/attendance`, { fullName: marker, phone: fixturePhone, email: fixtureEmail }, 201);
    const list = await api('event_admin', 'rekap presensi rutin', 'GET', `/api/kajian-rutin/sessions/${session.id}/attendance`);
    verify('presensi rutin masuk rekap', JSON.stringify(list).includes(attendance.id));
    const profile = await api('crm_admin', 'profil 360 kajian rutin', 'GET', `/api/persons/${personId}`);
    verify('presensi rutin tersambung profil lewat kontak', JSON.stringify(profile).includes(attendance.id));
    await api('event_admin', 'regenerasi QR rutin', 'POST', `/api/kajian-rutin/sessions/${session.id}/rotate-qr`);
    await api('event_admin', 'buat pengumuman', 'POST', '/api/kajian-rutin/announcements', { title: marker, body: `${marker} informasi kegiatan.` }, 201);
    const publicAnnouncements = await api(null, 'pengumuman publik', 'GET', '/api/public/kajian-rutin/announcements');
    verify('pengumuman tampil publik', JSON.stringify(publicAnnouncements).includes(marker));
  });
  await scenario('bazar, tenant, stan dan evaluasi', async () => {
    await api('event_admin', 'aktifkan bazar event', 'POST', `/api/events/${eventId}/bazaar`, { title: marker, defaultFeeRupiah: 0 });
    await api('event_admin', 'buat stan bazar', 'POST', `/api/events/${eventId}/bazaar/booths/bulk`, { booths: [{ code: 'UAT-01', name: 'Stan UAT', priceRupiah: 0 }] });
    const bazaar = (await pool.query('SELECT id FROM bazaar_events WHERE event_id = $1', [eventId])).rows[0];
    const booth = (await pool.query('SELECT id FROM bazaar_booths WHERE bazaar_id = $1', [bazaar.id])).rows[0];
    const applied = await api(null, 'pendaftaran tenant publik', 'POST', `/api/public/events/${eventId}/bazaar/apply`, { brandName: marker, businessCategory: 'kuliner', picName: marker, picPhone: fixturePhone, productDescription: 'Produk sintetis pengujian' });
    const applicationId = applied.application.id;
    verify('tenant tersambung jamaah', applied.tenant.personId === personId);
    await api('event_admin', 'terima tenant', 'PUT', `/api/events/${eventId}/bazaar/applications/${applicationId}/status`, { status: 'accepted' });
    await api('event_admin', 'penempatan stan', 'PUT', `/api/events/${eventId}/bazaar/applications/${applicationId}/assign-booth`, { boothId: booth.id, isPublished: true });
    await api('event_admin', 'check-in tenant', 'POST', `/api/events/${eventId}/bazaar/check-in`, { applicationId });
    await api('event_admin', 'evaluasi tenant', 'POST', `/api/events/${eventId}/bazaar/evaluations`, { applicationId, internalNotes: marker });
    const tenantProfile = await api('event_admin', 'profil tenant', 'GET', `/api/bazaar/tenants/${applied.tenant.id}`);
    verify('riwayat tenant dan stan tersedia', JSON.stringify(tenantProfile).includes(applicationId));
  });
  await scenario('provisioning, sandi, role dan pencabutan sesi', async () => {
    const password = `Uat!${randomBytes(18).toString('base64url')}`;
    const email = `staff-${run}@example.test`;
    const staff = await api('crm_admin', 'buat staf melalui pengaturan', 'POST', '/api/settings/users', { email, fullName: marker, roleCodes: ['cs_officer'], password }, 201);
    const login = await api(null, 'login staf baru', 'POST', '/api/auth/login', { email, password });
    tokens.set('uat_staff', login.token);
    const nextPassword = `New!${randomBytes(18).toString('base64url')}`;
    await api('uat_staff', 'ubah sandi sendiri', 'POST', '/api/settings/change-password', { currentPassword: password, newPassword: nextPassword });
    await api('uat_staff', 'sesi lama setelah ganti sandi dicabut', 'GET', '/api/auth/me', undefined, 401);
    const renewed = await api(null, 'login dengan sandi baru', 'POST', '/api/auth/login', { email, password: nextPassword });
    tokens.set('uat_staff', renewed.token);
    await api('crm_admin', 'nonaktifkan akun uji', 'PATCH', `/api/settings/users/${staff.id}/status`, { isActive: false });
    await api('uat_staff', 'akun nonaktif tidak memakai sesi lama', 'GET', '/api/auth/me', undefined, 401);
    await api(null, 'akun nonaktif tidak login', 'POST', '/api/auth/login', { email, password: nextPassword }, 401);
    await api('crm_admin', 'aktifkan akun uji', 'PATCH', `/api/settings/users/${staff.id}/status`, { isActive: true });
    await api('uat_staff', 'aktivasi tidak menghidupkan sesi yang dicabut', 'GET', '/api/auth/me', undefined, 401);
    await api('crm_admin', 'ubah peran akun', 'PUT', `/api/settings/users/${staff.id}/roles`, { roleCodes: ['auditor'] });
    const newRole = await api(null, 'login dengan role terbaru', 'POST', '/api/auth/login', { email, password: nextPassword });
    verify('role tersambung ke sesi', newRole.user.roles.includes('auditor') && !newRole.user.roles.includes('cs_officer'));
  });
  const currentRows = new Map((await legacyRows()).map((row: any) => [`${row.table_name}:${row.row_hash}`, row.copies]));
  const allOldRowsPreserved = originalRows.every((row: any) => Number(currentRows.get(`${row.table_name}:${row.row_hash}`) || 0) >= row.copies);
  checks.push({ feature: 'semua baris bisnis lama di salinan tetap utuh', passed: allOldRowsPreserved });
  const report = { environment: 'staging', runAt: new Date().toISOString(), fixtureMarker: marker, total: checks.length, passed: checks.filter((c) => c.passed).length, failed: checks.filter((c) => !c.passed).length, originalBusinessRowsPreserved: allOldRowsPreserved, checks, appErrors: [...new Set(appErrors)] };
  saveReport('staging-workflow-verification.json', report);
  console.log(JSON.stringify({ ...report, checks: report.checks.filter((c) => !c.passed) }));
  process.exitCode = report.failed ? 1 : 0;
} finally {
  console.error = originalError;
  const { getDbPool } = await import('../server/db/client');
  await getDbPool().end();
  await pool.end();
}
