import { retryConnectionRead } from "../server/db/readRetry";
import {
  prepareEnvironment,
  readVault,
  saveReport,
  targets,
} from "./access-runtime";
import {
  hasPermission,
  PERMISSIONS,
  type RoleCode,
} from "../server/permissions/constants";
if (process.argv[process.argv.indexOf("--environment") + 1] !== "staging")
  throw new Error("Mutasi Kajian Rutin hanya di staging.");
const vault = readVault("staging");
if (!vault) throw new Error("Vault staging tidak tersedia.");
const pool = prepareEnvironment("staging", vault);
pool.on("error", () => {
  /* A failed idle test connection is replaced by the pool. */
});
process.env.MAILKETING_API_TOKEN = "";
process.env.MAILKETING_API_KEY = "";
const { handler } = await import("../netlify/functions/api");
const marker = `UAT Rutin ${Date.now().toString(36)}`;
const tokens = new Map<string, string>();
const checks: Array<{ feature: string; passed: boolean; actual?: number }> = [];
const seriesIds: string[] = [];
let counter = 0;
const phone = () =>
  `+628${Date.now().toString().slice(-9)}${String(counter++).padStart(3, "0")}`;
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
  role: string | null = "crm_admin",
) {
  const url = new URL(path, "http://localhost");
  const response = await handler({
    path: url.pathname,
    httpMethod: method,
    headers: role ? { authorization: `Bearer ${tokens.get(role)}` } : {},
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body === undefined ? null : JSON.stringify(body),
  });
  const json = JSON.parse(response.body || "{}");
  const passed = (Array.isArray(expected) ? expected : [expected]).includes(
    response.statusCode,
  );
  checks.push({ feature, passed, actual: response.statusCode });
  if (!passed)
    throw new Error(
      `${feature}: HTTP ${response.statusCode}; ${json.error?.message || ""}`,
    );
  return json.data;
}
const businessTables = (targets.legacyTables as string[]).filter(
  (table) =>
    ![
      "app_users",
      "audit_logs",
      "rate_limits",
      "kajian_rutin_rate_limits",
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
        .join(" UNION ALL "),
    )
  ).rows;
}
let before: any[] = [];
let errorMessage = "";
try {
  before = await retryConnectionRead(() => legacyRows());
  for (const account of vault.accounts) {
    const login = await api(
      `login ${account.role}`,
      "POST",
      "/api/auth/login",
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
      "GET",
      "/api/kajian-rutin/series",
      undefined,
      allowed ? 200 : 403,
      account.role,
    );
  }
  await api(
    "anonim ditolak",
    "GET",
    "/api/kajian-rutin/series",
    undefined,
    401,
    null,
  );
  const today = new Date(Date.now() + 25_200_000).toISOString().slice(0, 10);
  const base = {
    title: marker,
    recurrence: "weekly",
    dayOfWeek: 0,
    startDate: today,
    startTime: "12:00",
    endTime: "13:00",
    checkInOpenMinutes: 1440,
    checkInCloseMinutes: 1440,
    targetAudience: "umum",
    quota: 10,
  };
  await api(
    "tanggal kalender mustahil ditolak",
    "POST",
    "/api/kajian-rutin/series",
    { ...base, startDate: "2026-02-30" },
    400,
  );
  await api(
    "jam terbalik ditolak",
    "POST",
    "/api/kajian-rutin/series",
    { ...base, endTime: "11:00" },
    400,
  );
  const series = await api(
    "buat seri dan sesi pertama",
    "POST",
    "/api/kajian-rutin/series",
    base,
    201,
  );
  seriesIds.push(series.id);
  let detail = await api(
    "detail sesi",
    "GET",
    "/api/kajian-rutin/series/" + series.id + "/sessions",
  );
  const session = detail.sessions[0];
  verify(
    "sesi pertama WIB dan waktu selesai tersimpan",
    session.sessionDate === today && !!session.endAt,
  );
  const post = (name: string, body: unknown, expected = 201) =>
    api(
      name,
      "POST",
      "/api/kajian-rutin/sessions/" + session.id + "/attendance",
      body,
      expected,
    );
  const first = await post("presensi manual terhubung Jamaah", {
    fullName: marker + " Jamaah",
    email: "rutin." + Date.now() + "@example.test",
    phone: phone(),
    gender: "ikhwan",
  });
  verify("FK profil tersimpan", !!first.personId);
  await post(
    "presensi ganda kontak ditolak",
    { fullName: first.fullName, email: first.email, phone: first.phone },
    409,
  );
  await post(
    "duplikat profil tanpa kontak ditolak",
    { fullName: first.fullName, personId: first.personId },
    409,
  );
  const noContact = await post("nama tanpa kontak tetap terhubung Jamaah", {
    fullName: marker + " Tanpa Kontak",
  });
  verify("profil nama saja memiliki FK", !!noContact.personId);
  const person = await api(
    "profil Jamaah terhubung ke sesi",
    "GET",
    "/api/persons/" + noContact.personId,
  );
  verify(
    "riwayat nama saja tampil di Jamaah",
    JSON.stringify(person).includes(session.id),
  );
  await post(
    "telepon berhuruf ditolak",
    { fullName: marker, phone: "abc081234567890" },
    400,
  );
  let roster = await api(
    "daftar dan peringkat hadir",
    "GET",
    "/api/kajian-rutin/sessions/" + session.id + "/attendance",
  );
  verify(
    "hanya hadir dihitung",
    roster.presentCount === 2 &&
      roster.items.every((row: any) => row.earlyRank),
  );
  await api(
    "koreksi presensi dengan alasan",
    "PATCH",
    "/api/kajian-rutin/attendance/" + first.id,
    { status: "voided", reason: "Salah pencatatan UAT" },
  );
  roster = await api(
    "koreksi tidak dihitung hadir",
    "GET",
    "/api/kajian-rutin/sessions/" + session.id + "/attendance",
  );
  verify(
    "koreksi tetap tersimpan dan tidak mendapat peringkat",
    roster.presentCount === 1 &&
      roster.items.find((row: any) => row.id === first.id)?.earlyRank === null,
  );
  await api(
    "pulihkan presensi",
    "PATCH",
    "/api/kajian-rutin/attendance/" + first.id,
    { status: "present", reason: "Pulihkan hasil UAT" },
  );
  const stored = (
    await pool.query(
      "SELECT check_in_at FROM kajian_rutin_attendance WHERE id=$1",
      [first.id],
    )
  ).rows[0];
  verify(
    "waktu asli tidak ditulis ulang",
    new Date(stored.check_in_at).toISOString() === first.checkInAt,
  );
  const formula = await post("konten formula sebagai teks", {
    fullName: "=2+2",
    email: "formula." + Date.now() + "@example.test",
  });
  const csv = await api(
    "ekspor filter tercatat audit",
    "POST",
    "/api/kajian-rutin/sessions/" + session.id + "/attendance/export",
    { ids: [formula.id], reason: "Laporan UAT" },
  );
  verify(
    "CSV satu hasil dan formula aman",
    csv.count === 1 &&
      csv.csv.includes("'=2+2") &&
      !csv.csv.includes(first.email),
  );
  await api(
    "ekspor tanpa alasan ditolak",
    "POST",
    "/api/kajian-rutin/sessions/" + session.id + "/attendance/export",
    { ids: [formula.id], reason: "" },
    400,
  );
  await api(
    "hapus seri berisi riwayat dicegah",
    "DELETE",
    "/api/kajian-rutin/series/" + series.id,
    undefined,
    409,
  );
  await api(
    "ubah status sesi",
    "PATCH",
    "/api/kajian-rutin/sessions/" + session.id,
    { status: "cancelled" },
  );
  detail = await api(
    "periksa waktu sesi setelah pembatalan",
    "GET",
    "/api/kajian-rutin/series/" + series.id + "/sessions",
  );
  verify(
    "edit status menjaga waktu mulai dan selesai",
    detail.sessions[0].startAt === session.startAt &&
      detail.sessions[0].endAt === session.endAt,
  );
  await post("sesi batal menolak presensi", { fullName: marker }, 409);
  await api(
    "pulihkan sesi",
    "PATCH",
    "/api/kajian-rutin/sessions/" + session.id,
    { status: "scheduled" },
  );
  await api("arsip seri", "PATCH", "/api/kajian-rutin/series/" + series.id, {
    isActive: false,
  });
  await post("seri arsip menolak presensi", { fullName: marker }, 409);
  await api(
    "seri arsip tidak membuat jadwal",
    "POST",
    "/api/kajian-rutin/series/" + series.id + "/sessions/generate",
    { count: 1 },
    409,
  );
  await api("pulihkan seri", "PATCH", "/api/kajian-rutin/series/" + series.id, {
    isActive: true,
  });
  const generated = await api(
    "jadwal bulanan kalender",
    "POST",
    "/api/kajian-rutin/series",
    {
      ...base,
      title: marker + " Bulanan",
      recurrence: "monthly",
      startDate: "2026-11-01",
    },
    201,
  );
  seriesIds.push(generated.id);
  const monthly = await api(
    "buat 4 bulan",
    "POST",
    "/api/kajian-rutin/series/" + generated.id + "/sessions/generate",
    { count: 4 },
    201,
  );
  const dates = monthly.plannedDates;
  verify(
    "tanggal bulanan tidak bergeser setiap 4 pekan",
    dates.length === 4 &&
      dates.every(
        (date: string) =>
          Number(date.slice(8)) <= 7 && new Date(date).getUTCDay() === 0,
      ) &&
      new Set(dates.map((date: string) => date.slice(0, 7))).size === 4,
  );
  const cap = await api(
    "seri kuota satu",
    "POST",
    "/api/kajian-rutin/series",
    { ...base, title: marker + " Kuota", quota: 1 },
    201,
  );
  seriesIds.push(cap.id);
  const capSession = (
    await api(
      "sesi kuota",
      "GET",
      "/api/kajian-rutin/series/" + cap.id + "/sessions",
    )
  ).sessions[0];
  const race = await Promise.all(
    [0, 1].map(async (index) => {
      const result = await handler({
        path: "/api/kajian-rutin/sessions/" + capSession.id + "/attendance",
        httpMethod: "POST",
        headers: { authorization: "Bearer " + tokens.get("crm_admin") },
        queryStringParameters: {},
        body: JSON.stringify({
          fullName: marker + " Race " + index,
          email: "race" + index + "." + Date.now() + "@example.test",
        }),
      });
      return result.statusCode;
    }),
  );
  verify(
    "dua presensi bersamaan tidak melampaui kuota",
    race.filter((code) => code === 201).length === 1 &&
      race.filter((code) => code === 409).length === 1,
  );
  const genderSeries = await api(
    "seri segmen Ikhwan",
    "POST",
    "/api/kajian-rutin/series",
    { ...base, title: marker + " Segmen", targetAudience: "ikhwan_only" },
    201,
  );
  seriesIds.push(genderSeries.id);
  const genderSession = (
    await api(
      "sesi segmen",
      "GET",
      "/api/kajian-rutin/series/" + genderSeries.id + "/sessions",
    )
  ).sessions[0];
  await api(
    "segmen Akhwat ditolak pada Ikhwan",
    "POST",
    "/api/kajian-rutin/sessions/" + genderSession.id + "/attendance",
    { fullName: marker, gender: "akhwat" },
    400,
  );
  const account = (
    await pool.query(
      "INSERT INTO kajian_rutin_accounts(google_sub,email,full_name,gender,phone) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [
        "uat-rutin-" + Date.now(),
        first.email,
        first.fullName,
        "ikhwan",
        first.phone,
      ],
    )
  ).rows[0];
  const { createJamaahPortalToken } = await import(
    "../server/domain/kajian-rutin/tokens"
  );
  const portalToken = createJamaahPortalToken({
    accountId: account.id,
    sub: account.google_sub,
    email: account.email,
    name: account.full_name,
  });
  async function portal(
    name: string,
    method: string,
    path: string,
    body?: unknown,
    expected = 200,
  ) {
    const result = await handler({
      path,
      httpMethod: method,
      headers: {
        authorization: "Bearer " + portalToken,
        "x-nf-client-connection-ip": "192.0.2.70",
      },
      queryStringParameters: {},
      body: body ? JSON.stringify(body) : null,
    });
    verify(name + " HTTP " + result.statusCode, result.statusCode === expected);
    return JSON.parse(result.body || "{}").data;
  }
  const portalHistory = await portal(
    "portal memuat presensi panitia",
    "GET",
    "/api/public/kajian-rutin/portal/me",
  );
  verify(
    "riwayat portal dan manual menyatu",
    portalHistory.history.some((row: any) => row.id === first.id),
  );
  const repeated = await portal(
    "portal idempoten lintas jalur",
    "POST",
    "/api/public/kajian-rutin/portal/absen",
    { sessionId: session.id },
  );
  verify(
    "portal memakai presensi yang sama",
    repeated.alreadyAbsen && repeated.attendance.id === first.id,
  );
  const oldQr = session.qrToken;
  const rotated = await api(
    "rotasi QR",
    "POST",
    "/api/kajian-rutin/sessions/" + session.id + "/rotate-qr",
  );
  await portal(
    "QR lama ditolak",
    "POST",
    "/api/public/kajian-rutin/portal/absen",
    { sessionId: session.id, token: oldQr },
    403,
  );
  verify("QR diganti", rotated.qrToken !== oldQr);
  await portal(
    "portal mematuhi kuota sesi lain",
    "POST",
    "/api/public/kajian-rutin/portal/absen",
    { sessionId: capSession.id },
    409,
  );
  await api(
    "koreksi manual terhubung portal",
    "PATCH",
    "/api/kajian-rutin/attendance/" + first.id,
    { status: "voided", reason: "Koreksi portal UAT" },
  );
  const correctedHistory = await portal(
    "riwayat portal setelah koreksi",
    "GET",
    "/api/public/kajian-rutin/portal/me",
  );
  verify(
    "portal tidak menghitung catatan dikoreksi",
    !correctedHistory.history.some((row: any) => row.id === first.id),
  );
  await portal(
    "portal tidak menghidupkan koreksi sendiri",
    "POST",
    "/api/public/kajian-rutin/portal/absen",
    { sessionId: session.id },
    409,
  );
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = "absen:" + account.google_sub + ":" + hour;
  await pool.query(
    "INSERT INTO kajian_rutin_rate_limits(key,hits,expires_at) VALUES($1,999,now()-interval '1 hour') ON CONFLICT(key) DO UPDATE SET hits=999,expires_at=now()-interval '1 hour'",
    [key],
  );
  await portal(
    "rate limit kedaluwarsa diperbarui",
    "POST",
    "/api/public/kajian-rutin/portal/absen",
    { sessionId: "00000000-0000-4000-8000-000000000099" },
    404,
  );
  const limit = (
    await pool.query(
      "SELECT hits,expires_at>now() AS future FROM kajian_rutin_rate_limits WHERE key=$1",
      [key],
    )
  ).rows[0];
  verify(
    "penghitung dan masa berlaku direset",
    limit.hits === 1 && limit.future,
  );
  const paid = await api(
    "buat daurah untuk uji portal",
    "POST",
    "/api/events",
    {
      title: marker + " Daurah",
      speaker: "Pemateri UAT",
      category: "Daurah Khusus",
      startAt: new Date(Date.now() - 3_600_000).toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
      deliveryMode: "offline",
      locationName: "Staging",
      targetAudience: "umum",
      isPaid: true,
      priceRupiah: 50000,
      isRegistrationOpen: true,
    },
    201,
  );
  const paidAttendance = (
    await pool.query(
      "INSERT INTO event_attendance(event_id,person_id,status,payment_status,registration_data) VALUES($1,$2,'registered','free',$3::jsonb) RETURNING id",
      [paid.id, first.personId, JSON.stringify({ email: first.email })],
    )
  ).rows[0];
  await portal(
    "portal daurah tidak melewati verifikasi pembayaran lama",
    "POST",
    "/api/public/kajian-rutin/portal/absen-daurah",
    { eventId: paid.id },
    400,
  );
  verify(
    "tiket berbayar lama tetap terdaftar",
    (
      await pool.query(
        "SELECT status,payment_status FROM event_attendance WHERE id=$1",
        [paidAttendance.id],
      )
    ).rows[0]?.status === "registered",
  );
  const mergeA = await post("presensi profil utama merge", {
    fullName: marker + " Utama Merge",
  });
  const mergeB = await post("presensi profil duplikat merge", {
    fullName: marker + " Duplikat Merge",
  });
  const mergeBefore = await pool.query(
    "SELECT id,check_in_at FROM kajian_rutin_attendance WHERE id=ANY($1::uuid[])",
    [[mergeA.id, mergeB.id]],
  );
  await api(
    "merge Jamaah mempertahankan presensi rutin",
    "POST",
    "/api/data-quality/merge",
    {
      primaryPersonId: mergeA.personId,
      secondaryPersonId: mergeB.personId,
      reason: "Gabungkan fixture rutin staging",
    },
  );
  const mergeAfter = (
    await pool.query(
      "SELECT id,status,person_id,check_in_at FROM kajian_rutin_attendance WHERE id=ANY($1::uuid[])",
      [[mergeA.id, mergeB.id]],
    )
  ).rows;
  verify(
    "kedua riwayat merge utuh dan satu dihitung hadir",
    mergeAfter.length === 2 &&
      mergeAfter.filter((row) => row.status === "present").length === 1 &&
      mergeAfter.every(
        (row) =>
          new Date(row.check_in_at).toISOString() ===
          new Date(
            mergeBefore.rows.find(
              (item: any) => item.id === row.id,
            ).check_in_at,
          ).toISOString(),
      ),
  );
  await api(
    "presensi duplikat merge tidak dipulihkan sembarang",
    "PATCH",
    "/api/kajian-rutin/attendance/" + mergeB.id,
    { status: "present", reason: "Uji profil gabungan" },
    409,
  );
  for (const account of vault.accounts) {
    const role = account.role as RoleCode;
    const allowed = hasPermission([role], PERMISSIONS.ATTENDANCE_VIEW_SUMMARY);
    const detail = await api(
      "akses presensi " + role,
      "GET",
      "/api/kajian-rutin/sessions/" + session.id + "/attendance",
      undefined,
      allowed ? 200 : 403,
      role,
    );
    if (allowed && !hasPermission([role], PERMISSIONS.ATTENDANCE_MANAGE))
      verify(
        "ringkasan tidak membocorkan kontak dan QR " + role,
        detail.summaryOnly &&
          detail.items.length === 0 &&
          !detail.session.qrToken,
      );
    await api(
      "hak ekspor " + role,
      "POST",
      "/api/kajian-rutin/sessions/" + session.id + "/attendance/export",
      { ids: [formula.id], reason: "UAT hak akses" },
      hasPermission([role], PERMISSIONS.DATA_EXPORT) &&
        hasPermission([role], PERMISSIONS.ATTENDANCE_MANAGE)
        ? 200
        : 403,
      role,
    );
  }
  const announcement = await api(
    "buat pengumuman",
    "POST",
    "/api/kajian-rutin/announcements",
    { title: marker, body: "Pengumuman pengujian staging", isPinned: true },
    201,
  );
  await api(
    "arsip pengumuman",
    "DELETE",
    "/api/kajian-rutin/announcements/" + announcement.id,
  );
  verify(
    "arsip pengumuman mempertahankan riwayat",
    (
      await pool.query(
        "SELECT is_active FROM kajian_rutin_announcements WHERE id=$1",
        [announcement.id],
      )
    ).rows[0]?.is_active === false,
  );
  const publicAnnouncements = await api(
    "pengumuman publik",
    "GET",
    "/api/public/kajian-rutin/announcements",
    undefined,
    200,
    null,
  );
  verify(
    "pengumuman arsip tidak dipublikasikan",
    !publicAnnouncements.some((row: any) => row.id === announcement.id),
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
    feature: "seluruh baris bisnis lama tetap utuh",
    passed: preserved,
  });
  const report = {
    environment: "staging",
    at: new Date().toISOString(),
    marker,
    seriesIds,
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    oldBusinessRowsPreserved: preserved,
    error: errorMessage,
    checks,
  };
  saveReport("staging-routine-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((row) => !row.passed) }),
  );
  if (report.failed) process.exitCode = 1;
  const { getDbPool } = await import("../server/db/client");
  await getDbPool().end();
  await pool.end();
}
