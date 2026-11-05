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
  throw new Error("Mutasi Bazaar hanya di staging.");
const vault = readVault("staging");
if (!vault) throw new Error("Vault staging tidak tersedia.");
const pool = prepareEnvironment("staging", vault);
pool.on("error", () => {
  /* A failed idle test connection is replaced by the pool. */
});
process.env.MAILKETING_API_TOKEN = "";
process.env.MAILKETING_API_KEY = "";
const { handler } = await import("../netlify/functions/api");
const marker = `UAT Bazar ${Date.now().toString(36)}`;
const tokens = new Map<string, string>();
const checks: Array<{ feature: string; passed: boolean; actual?: number }> = [];
const eventIds: string[] = [];
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
      "/api/bazaar/overview",
      undefined,
      allowed ? 200 : 403,
      account.role,
    );
  }
  await api(
    "anonim ditolak",
    "GET",
    "/api/bazaar/overview",
    undefined,
    401,
    null,
  );
  const base = {
    title: marker,
    speaker: "Pemateri UAT",
    category: "Daurah Khusus",
    startAt: new Date(Date.now() + 86400000).toISOString(),
    endAt: new Date(Date.now() + 86400000 + 7200000).toISOString(),
    targetAudience: "umum",
    deliveryMode: "offline",
    locationName: "Staging",
    isRegistrationOpen: true,
  };
  const event = await api("buat event induk", "POST", "/api/events", base, 201);
  eventIds.push(event.id);
  const path = "/api/events/" + event.id + "/bazaar";
  const pub = "/api/public/events/" + event.id + "/bazaar";
  const bazaar = await api("siapkan bazar", "POST", path, {
    title: marker,
    isOpen: true,
    defaultFeeRupiah: 0,
  });
  verify(
    "pembayaran tidak aktif secara default",
    bazaar.paymentEnabled === false,
  );
  const publicGet = () =>
    api("portal bazar publik", "GET", pub, undefined, 200, null);
  const info = await publicGet();
  verify(
    "rekening belum aktif tidak diumumkan",
    info.bazaar.paymentConfigured === false && !info.bazaar.bankAccountNumber,
  );
  const signup = (suffix: string, contact = phone()) => ({
    brandName: marker + " " + suffix,
    businessCategory: "kuliner",
    picName: "PIC " + marker,
    picPhone: contact,
    picEmail:
      "bazar." + suffix.replace(/\W/g, "") + "." + Date.now() + "@example.test",
    productDescription: "Produk pengujian staging",
    agreedToRules: true,
    infaqAmountRupiah: 1,
  });
  const firstInput = signup("Usaha A");
  const first = await api(
    "daftar tenant terhubung Jamaah",
    "POST",
    pub + "/apply",
    firstInput,
    200,
    null,
  );
  verify(
    "tarif ditentukan server dan kode akses diterbitkan",
    first.application.infaqAmountRupiah === 0 &&
      first.accessToken.startsWith("bazaar-access."),
  );
  const master = (
    await pool.query(
      "SELECT person_id,pic_name,pic_email FROM bazaar_tenants WHERE id=$1",
      [first.tenant.id],
    )
  ).rows[0];
  verify("tenant memiliki FK Jamaah", !!master.person_id);
  await api(
    "duplikat ditolak tanpa menimpa profil",
    "POST",
    pub + "/apply",
    { ...firstInput, picName: "Nama yang tidak boleh menimpa" },
    409,
    null,
  );
  verify(
    "nama lama tenant tidak berubah saat pendaftaran ganda",
    (
      await pool.query("SELECT pic_name FROM bazaar_tenants WHERE id=$1", [
        first.tenant.id,
      ])
    ).rows[0]?.pic_name === master.pic_name,
  );
  const second = await api(
    "brand sama kontak berbeda tidak digabung",
    "POST",
    pub + "/apply",
    { ...signup("Usaha B"), brandName: firstInput.brandName },
    200,
    null,
  );
  verify("identitas dua usaha dipisah", first.tenant.id !== second.tenant.id);
  await api(
    "telepon berhuruf ditolak",
    "POST",
    pub + "/apply",
    { ...signup("Invalid"), picPhone: "abc081234567890" },
    400,
    null,
  );
  await api(
    "pembayaran palsu melalui request ditolak saat rekening mati",
    "POST",
    pub + "/apply",
    { ...signup("Proof"), paymentProofUrl: "https://example.test/proof.png" },
    409,
    null,
  );
  const forged =
    first.accessToken.slice(0, -1) +
    (first.accessToken.endsWith("a") ? "b" : "a");
  async function privateApi(
    name: string,
    method: string,
    suffix: string,
    token: string,
    body?: unknown,
    expected = 200,
  ) {
    const result = await handler({
      path: pub + suffix,
      httpMethod: method,
      headers: { authorization: "Bearer " + token },
      queryStringParameters: {},
      body: body ? JSON.stringify(body) : null,
    });
    verify(name + " HTTP " + result.statusCode, result.statusCode === expected);
    return JSON.parse(result.body || "{}").data;
  }
  await api(
    "status tidak terbuka dengan UUID publik",
    "GET",
    pub + "/check-status?appId=" + first.application.id,
    undefined,
    401,
    null,
  );
  await api(
    "status tidak terbuka dengan nomor telepon",
    "GET",
    pub + "/check-status?phone=" + encodeURIComponent(firstInput.picPhone),
    undefined,
    401,
    null,
  );
  await privateApi(
    "kode akses palsu ditolak",
    "GET",
    "/check-status",
    forged,
    undefined,
    401,
  );
  const privateStatus = await privateApi(
    "kode asli memuat status sendiri",
    "GET",
    "/check-status",
    first.accessToken,
  );
  verify(
    "catatan internal tidak ada pada portal tenant",
    privateStatus.application.id === first.application.id &&
      !("adminNotes" in privateStatus.application) &&
      !("paymentNotes" in privateStatus.application),
  );
  await api(
    "check-in sebelum kurasi ditolak",
    "POST",
    path + "/check-in",
    { applicationId: first.application.id },
    409,
  );
  await api(
    "loncat tahap status ditolak",
    "PUT",
    path + "/applications/" + first.application.id + "/status",
    { status: "checked_in" },
    409,
  );
  const setStatus = (app: any, status: string, extra: any = {}) =>
    api(
      "ubah tahap " + status,
      "PUT",
      path + "/applications/" + app.application.id + "/status",
      { status, ...extra },
    );
  for (const app of [first, second]) {
    await setStatus(app, "accepted");
    await setStatus(app, "payment_verified", {
      paymentNotes: "Pembebasan biaya UAT",
    });
  }
  const booths = await api("buat dua stan", "POST", path + "/booths/bulk", {
    booths: [
      {
        code: "A-01",
        name: "Stan A",
        priceRupiah: 0,
        allowedCategory: "kuliner",
      },
      {
        code: "A-02",
        name: "Stan B",
        priceRupiah: 0,
        allowedCategory: "kuliner",
      },
    ],
  });
  await api(
    "batch kode stan ganda ditolak atomik",
    "POST",
    path + "/booths/bulk",
    {
      booths: [
        { code: "NEW", name: "Baru" },
        { code: "A-01", name: "Duplikat" },
      ],
    },
    409,
  );
  verify(
    "batch gagal tidak meninggalkan stan parsial",
    !(
      await pool.query(
        "SELECT id FROM bazaar_booths WHERE bazaar_id=$1 AND code=$2",
        [bazaar.id, "NEW"],
      )
    ).rows.length,
  );
  const race = await Promise.all(
    [first, second].map(async (app) => {
      const result = await handler({
        path: path + "/applications/" + app.application.id + "/assign-booth",
        httpMethod: "PUT",
        headers: { authorization: "Bearer " + tokens.get("crm_admin") },
        queryStringParameters: {},
        body: JSON.stringify({ boothId: booths[0].id, isPublished: false }),
      });
      return { app, code: result.statusCode };
    }),
  );
  verify(
    "dua penetapan bersamaan tidak mengisi stan yang sama",
    race.filter((row) => row.code === 200).length === 1 &&
      race.filter((row) => row.code === 409).length === 1,
  );
  const placed = race.find((row) => row.code === 200)!.app;
  const waiting = race.find((row) => row.code === 409)!.app;
  await api(
    "stan terisi tidak bisa diblokir",
    "PUT",
    path + "/booths/" + booths[0].id,
    { status: "blocked" },
    409,
  );
  await api(
    "stan bersejarah tidak dihapus",
    "DELETE",
    path + "/booths/" + booths[0].id,
    undefined,
    409,
  );
  const hidden = await publicGet();
  verify(
    "penempatan belum terbit tidak dipublikasikan",
    hidden.bazaar.showcaseTenants.length === 0,
  );
  await api("terbitkan penempatan", "PUT", path + "/publish-layout", {
    isPublished: true,
  });
  const published = await publicGet();
  const showcase = published.bazaar.showcaseTenants;
  verify(
    "katalog hanya memuat penempatan terbit tanpa kontak pribadi atau ID pendaftaran",
    showcase.length === 1 &&
      showcase.every(
        (row: any) =>
          !row.picPhone &&
          !row.picEmail &&
          !row.picName &&
          row.id !== placed.application.id,
      ),
  );
  const checkIn = await api(
    "check-in tenant berstan dan terverifikasi",
    "POST",
    path + "/check-in",
    { applicationId: placed.application.id },
  );
  const again = await api(
    "check-in berulang idempoten",
    "POST",
    path + "/check-in",
    { applicationId: placed.application.id },
  );
  verify(
    "waktu hadir asli tidak ditimpa",
    again.checkedInAt === checkIn.checkedInAt,
  );
  const surveyBody = {
    applicationId: placed.application.id,
    satisfactionOverall: 5,
    satisfactionLocation: 4,
    satisfactionFacilities: 4,
    satisfactionCommunication: 5,
    satisfactionTraffic: 4,
    omzetRange: "<1m",
    feedback: "UAT survei",
    willingToJoinNext: true,
  };
  await privateApi(
    "survei sebelum kegiatan selesai ditolak",
    "POST",
    "/survey",
    placed.accessToken,
    surveyBody,
    409,
  );
  await api(
    "survei anonim tidak dapat mengubah tahap",
    "POST",
    pub + "/survey",
    surveyBody,
    401,
    null,
  );
  await api(
    "ubah biaya setelah hadir ditolak",
    "PUT",
    path + "/applications/" + placed.application.id + "/fee",
    { infaqAmountRupiah: 100 },
    409,
  );
  await api(
    "fee berubah menghapus verifikasi sebelumnya",
    "PUT",
    path + "/applications/" + waiting.application.id + "/fee",
    { infaqAmountRupiah: 100 },
  );
  const feeRow = (
    await pool.query(
      "SELECT status,payment_verified_at FROM bazaar_applications WHERE id=$1",
      [waiting.application.id],
    )
  ).rows[0];
  verify(
    "tagihan baru menunggu pembayaran",
    feeRow.status === "payment_pending" && !feeRow.payment_verified_at,
  );
  await api(
    "assign tanpa verifikasi ulang ditolak",
    "PUT",
    path + "/applications/" + waiting.application.id + "/assign-booth",
    { boothId: booths[1].id },
    409,
  );
  await privateApi(
    "unggah memerlukan pengaktifan rekening",
    "POST",
    "/upload-proof",
    waiting.accessToken,
    {
      applicationId: waiting.application.id,
      phone: waiting.tenant.picPhone,
      paymentProofUrl: "https://example.test/proof.png",
    },
    409,
  );
  await api(
    "rekening contoh tidak dapat diaktifkan",
    "PUT",
    path,
    {
      paymentEnabled: true,
      bankName: "BSI",
      bankAccountNumber: "7144778899",
      bankAccountName: "Contoh",
    },
    400,
  );
  await api("aktifkan rekening fixture staging eksplisit", "PUT", path, {
    paymentEnabled: true,
    bankName: "Bank UAT Staging",
    bankAccountNumber: "865001234567",
    bankAccountName: "Fixture Pengujian",
  });
  await privateApi(
    "kode tenant lain tidak dapat mengganti bukti",
    "POST",
    "/upload-proof",
    placed.accessToken,
    {
      applicationId: waiting.application.id,
      phone: waiting.tenant.picPhone,
      paymentProofUrl: "https://example.test/proof.png",
    },
    401,
  );
  await privateApi(
    "unggah bukti ke pendaftaran sendiri",
    "POST",
    "/upload-proof",
    waiting.accessToken,
    {
      applicationId: waiting.application.id,
      phone: waiting.tenant.picPhone,
      paymentProofUrl: "https://example.test/proof.png",
    },
  );
  await setStatus(waiting, "payment_verified");
  await api(
    "sinkron harga tidak menimpa kontrak terverifikasi",
    "PUT",
    path + "/applications/" + waiting.application.id + "/assign-booth",
    { boothId: booths[1].id, syncBoothPrice: true },
    409,
  );
  await api(
    "penempatan dengan biaya kontrak yang disetujui",
    "PUT",
    path + "/applications/" + waiting.application.id + "/assign-booth",
    { boothId: booths[1].id, syncBoothPrice: false },
  );
  await api(
    "batalkan tenant dengan alasan",
    "PUT",
    path + "/applications/" + waiting.application.id + "/status",
    { status: "cancelled", adminNotes: "Pembatalan UAT" },
  );
  verify(
    "pembatalan melepas stan dan menjaga riwayat",
    (
      await pool.query(
        "SELECT a.assigned_booth_id,b.status FROM bazaar_applications a JOIN bazaar_booths b ON b.id=a.assigned_booth_id WHERE a.id=$1",
        [waiting.application.id],
      )
    ).rows[0]?.status === "available",
  );
  await api("selesaikan event induk", "PUT", "/api/events/" + event.id, {
    startAt: new Date(Date.now() - 7200000).toISOString(),
    endAt: new Date(Date.now() - 3600000).toISOString(),
    status: "completed",
  });
  await privateApi(
    "survei hadir pasca-event tersambung",
    "POST",
    "/survey",
    placed.accessToken,
    surveyBody,
  );
  await privateApi(
    "survei ulang tidak menggandakan respons",
    "POST",
    "/survey",
    placed.accessToken,
    surveyBody,
    409,
  );
  const survey = (
    await api("statistik survei pengelola", "GET", path + "/surveys")
  ).items.find((row: any) => row.applicationId === placed.application.id);
  verify("survei menyimpan event kanonis", survey?.eventId === event.id);
  const exported = await api(
    "ekspor survei beralasan",
    "POST",
    path + "/export",
    { kind: "surveys", ids: [survey.id], reason: "Rekap UAT bazar" },
  );
  verify("ekspor hanya memuat ID terpilih", exported.count === 1);
  verify("ekspor mencakup seluruh rating dan waktu survei", ["Lokasi", "Fasilitas", "Komunikasi", "Pengunjung", "IkutLagi", "Dikirim"].every(column => exported.csv.includes(column)));
  await api("catat insiden tersambung", "POST", path + "/incidents", {
    applicationId: placed.application.id,
    type: "positive",
    category: "Kebersihan",
    severity: "minor",
    description: "Fixture kebersihan UAT",
  });
  await api("evaluasi tenant berflag", "POST", path + "/evaluations", {
    applicationId: placed.application.id,
    suggestedFlag: "review_next_event",
    internalNotes: "Perlu tinjau fixture",
  });
  await api("evaluasi normal memulihkan flag", "POST", path + "/evaluations", {
    applicationId: placed.application.id,
    suggestedFlag: "normal",
    internalNotes: "Tinjauan fixture selesai",
  });
  verify(
    "flag master mengikuti evaluasi terakhir",
    (
      await pool.query("SELECT internal_flag FROM bazaar_tenants WHERE id=$1", [
        placed.tenant.id,
      ])
    ).rows[0]?.internal_flag === "normal",
  );
  const linked = (
    await pool.query("SELECT person_id FROM bazaar_tenants WHERE id=$1", [
      placed.tenant.id,
    ])
  ).rows[0]?.person_id;
  const person = await api(
    "profil Jamaah memuat usaha dan riwayat bazar",
    "GET",
    "/api/persons/" + linked,
  );
  verify(
    "profil usaha dapat ditelusuri dari Jamaah",
    person.bazaarProfiles.some((row: any) => row.id === placed.tenant.id),
  );
  const parent = (
    await pool.query(
      "INSERT INTO persons(full_name,phone_e164) VALUES($1,$2) RETURNING id",
      [marker + " Master Merge", phone()],
    )
  ).rows[0];
  await api(
    "merge Jamaah mengikutkan tenant",
    "POST",
    "/api/data-quality/merge",
    {
      primaryPersonId: parent.id,
      secondaryPersonId: linked,
      reason: "Uji hubungan tenant dan Jamaah",
    },
  );
  verify(
    "FK tenant mengikuti profil utama",
    (
      await pool.query("SELECT person_id FROM bazaar_tenants WHERE id=$1", [
        placed.tenant.id,
      ])
    ).rows[0]?.person_id === parent.id,
  );
  const importRows = [
    {
      brandName: marker + " Impor, Koma",
      businessCategory: "kuliner",
      picName: "PIC Impor",
      picPhone: phone(),
      productDescription: "Produk, dengan koma",
    },
  ];
  const importBefore = await pool.query(
    "SELECT (SELECT count(*) FROM bazaar_tenants) tenants,(SELECT count(*) FROM persons) people",
  );
  const dry = await api(
    "pratinjau impor tanpa menulis",
    "POST",
    "/api/bazaar/tenants/import-legacy",
    { rows: importRows, dryRun: true },
  );
  const importAfter = await pool.query(
    "SELECT (SELECT count(*) FROM bazaar_tenants) tenants,(SELECT count(*) FROM persons) people",
  );
  verify(
    "pratinjau tidak menambah profil atau tenant",
    dry.dryRun &&
      JSON.stringify(importBefore.rows) === JSON.stringify(importAfter.rows),
  );
  const imported = await api(
    "terapkan impor valid",
    "POST",
    "/api/bazaar/tenants/import-legacy",
    { rows: importRows, dryRun: false },
  );
  verify("impor menambah satu tenant", imported.imported === 1);
  const repeat = await api(
    "impor ulang melengkapi tanpa menggandakan",
    "POST",
    "/api/bazaar/tenants/import-legacy",
    { rows: importRows },
  );
  verify(
    "impor ulang tidak membuat profil ganda",
    repeat.imported === 0 && repeat.merged === 1,
  );
  const malformed = await api(
    "impor menandai kontak tidak valid",
    "POST",
    "/api/bazaar/tenants/import-legacy",
    { rows: [{ ...importRows[0], picPhone: "abc081234567890" }], dryRun: true },
  );
  verify("baris invalid ditandai", malformed.invalid === 1);
  const quotaEvent = await api(
    "buat event kuota",
    "POST",
    "/api/events",
    { ...base, title: marker + " Kuota" },
    201,
  );
  eventIds.push(quotaEvent.id);
  const quotaPath = "/api/events/" + quotaEvent.id + "/bazaar";
  const quotaPub = "/api/public/events/" + quotaEvent.id + "/bazaar";
  await api("bazar dengan kuota kategori satu", "POST", quotaPath, {
    title: marker + " Kuota",
    isOpen: true,
    categoryQuotas: [{ category: "kuliner", maxQuota: 1 }],
  });
  const signups = await Promise.all(
    [0, 1].map(async (i) => {
      const result = await handler({
        path: quotaPub + "/apply",
        httpMethod: "POST",
        headers: {},
        queryStringParameters: {},
        body: JSON.stringify(signup("Kuota " + i)),
      });
      verify("pendaftaran kuota " + i, result.statusCode === 200);
      return JSON.parse(result.body).data;
    }),
  );
  verify(
    "kuota paralel menempatkan satu ke daftar tunggu",
    signups.filter((row) => row.application.status === "submitted").length ===
      1 &&
      signups.filter((row) => row.application.status === "waitlist").length ===
        1,
  );
  const wait = signups.find((row) => row.application.status === "waitlist"),
    lead = signups.find((row) => row.application.status === "submitted");
  await api(
    "promosi saat penuh ditolak",
    "PUT",
    quotaPath + "/applications/" + wait.application.id + "/status",
    { status: "accepted" },
    409,
  );
  await api(
    "batalkan pengisi slot kuota",
    "PUT",
    quotaPath + "/applications/" + lead.application.id + "/status",
    { status: "cancelled", adminNotes: "Uji pelepasan kuota" },
  );
  await api(
    "promosi daftar tunggu setelah slot kosong",
    "PUT",
    quotaPath + "/applications/" + wait.application.id + "/status",
    { status: "accepted" },
  );
  await api("batas survei valid dapat dikosongkan", "PUT", quotaPath, {
    surveyDeadline: new Date(Date.now() + 86400000 * 3).toISOString(),
  });
  const cleared = await api(
    "hapus batas survei secara eksplisit",
    "PUT",
    quotaPath,
    { surveyDeadline: null },
  );
  verify(
    "null benar-benar menghapus deadline",
    cleared.surveyDeadline === null,
  );
  for (const account of vault.accounts) {
    const role = account.role as RoleCode;
    await api(
      "hak impor " + role,
      "POST",
      "/api/bazaar/tenants/import-legacy",
      { rows: [] },
      hasPermission([role], PERMISSIONS.EVENTS_MANAGE) ? 400 : 403,
      role,
    );
    await api(
      "hak ekspor " + role,
      "POST",
      path + "/export",
      {
        kind: "applications",
        ids: [placed.application.id],
        reason: "UAT izin ekspor",
      },
      hasPermission([role], PERMISSIONS.EVENTS_MANAGE) &&
        hasPermission([role], PERMISSIONS.DATA_EXPORT)
        ? 200
        : 403,
      role,
    );
  }
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
    eventIds,
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    oldBusinessRowsPreserved: preserved,
    error: errorMessage,
    checks,
  };
  saveReport("staging-bazaar-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((row) => !row.passed) }),
  );
  if (report.failed) process.exitCode = 1;
  const { getDbPool } = await import("../server/db/client");
  await getDbPool().end();
  await pool.end();
}
