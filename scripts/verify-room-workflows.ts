import { randomUUID } from "node:crypto";
import { retryConnectionRead } from "../server/db/readRetry";
import {
  prepareEnvironment,
  readVault,
  saveReport,
  targets,
} from "./access-runtime";
import {
  hasPermission,
  PERMISSIONS as P,
  type RoleCode,
} from "../server/permissions/constants";
if (process.argv[process.argv.indexOf("--environment") + 1] !== "staging")
  throw new Error("Mutasi uji hanya untuk staging.");
const vault = readVault("staging");
if (!vault) throw new Error("Vault tidak tersedia.");
const pool = prepareEnvironment("staging", vault);
pool.on("error", () => {});
process.env.MAILKETING_API_TOKEN = "";
process.env.MAILKETING_API_KEY = "";
const { handler } = await import("../netlify/functions/api");
const marker = "UAT Ruang " + Date.now().toString(36),
  tokens = new Map<string, string>(),
  checks: Array<{ feature: string; passed: boolean; actual?: number }> = [];
let error = "",
  entryId = "",
  personId = "",
  eventId = "",
  storyId = "",
  before: any[] = [];
const tables = [...targets.legacyTables, "jamaah_room_activity"].filter(
  (t) =>
    ![
      "app_users",
      "audit_logs",
      "jamaah_room_rate_limits",
      "kajian_rutin_rate_limits",
    ].includes(t),
);
const hashes = async () =>
  (
    await pool.query(
      tables
        .map(
          (t) =>
            `SELECT '${t}' table_name,md5(to_jsonb(r)::text) row_hash,count(*)::int copies FROM public."${t}" r GROUP BY md5(to_jsonb(r)::text)`,
        )
        .join(" UNION ALL "),
    )
  ).rows;
function verify(feature: string, passed: boolean) {
  checks.push({ feature, passed });
  if (!passed) throw new Error(feature);
}
async function api(
  feature: string,
  method: string,
  path: string,
  body?: unknown,
  expected: number | number[] = 200,
  role: string | null = "crm_admin",
  ip = marker,
) {
  const url = new URL(path, "http://localhost"),
    response = await handler({
      path: url.pathname,
      httpMethod: method,
      headers: {
        ...(role ? { authorization: "Bearer " + tokens.get(role) } : {}),
        "x-nf-client-connection-ip": ip,
      },
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: body === undefined ? null : JSON.stringify(body),
    });
  const json = JSON.parse(response.body || "{}"),
    passed = (Array.isArray(expected) ? expected : [expected]).includes(
      response.statusCode,
    );
  checks.push({ feature, passed, actual: response.statusCode });
  if (!passed)
    throw new Error(
      feature +
        ": HTTP " +
        response.statusCode +
        "; " +
        (json.error?.message || ""),
    );
  return response.statusCode < 400 ? json.data : null;
}
try {
  before = await retryConnectionRead(hashes);
  for (const account of vault.accounts) {
    const data = await api(
      "login " + account.role,
      "POST",
      "/api/auth/login",
      { email: account.email, password: account.password },
      200,
      null,
    );
    tokens.set(account.role, data.token);
    await api(
      "izin inbox " + account.role,
      "GET",
      "/api/jamaah-room",
      undefined,
      hasPermission([account.role as RoleCode], P.INTERACTIONS_VIEW)
        ? 200
        : 403,
      account.role,
    );
    await api(
      "izin ubah " + account.role,
      "PATCH",
      "/api/jamaah-room/" + randomUUID(),
      {},
      hasPermission([account.role as RoleCode], P.INTERACTIONS_CREATE)
        ? 400
        : 403,
      account.role,
    );
    await api(
      "izin ekspor " + account.role,
      "POST",
      "/api/jamaah-room/export",
      {},
      hasPermission([account.role as RoleCode], P.INTERACTIONS_VIEW) &&
        hasPermission([account.role as RoleCode], P.DATA_EXPORT)
        ? 400
        : 403,
      account.role,
    );
  }
  await api(
    "anonim tidak dapat membuka inbox",
    "GET",
    "/api/jamaah-room",
    undefined,
    401,
    null,
  );
  const person = (
    await pool.query(
      "INSERT INTO persons(full_name,phone_e164,email) VALUES($1,$2,$3) RETURNING id,phone_e164,email",
      [
        marker,
        "+62877" + Date.now().toString().slice(-9),
        "room-" + Date.now() + "@example.test",
      ],
    )
  ).rows[0];
  personId = person.id;
  const event = await api(
    "event konteks staging",
    "POST",
    "/api/events",
    {
      title: marker,
      speaker: "Pemateri UAT",
      category: "Daurah Khusus",
      startAt: new Date(Date.now() + 86400000).toISOString(),
      deliveryMode: "offline",
      locationName: "Staging",
    },
    201,
  );
  eventId = event.id;
  const eventInfo = await api(
    "konteks event publik",
    "GET",
    "/api/public/jamaah-room/event/" + eventId,
    undefined,
    200,
    null,
  );
  verify(
    "konteks publik hanya id/judul",
    Object.keys(eventInfo).sort().join(",") === "id,title",
  );
  await api(
    "event tidak ada ditolak",
    "POST",
    "/api/public/jamaah-room",
    {
      category: "saran",
      subject: marker,
      message: "Masukan uji dengan event yang tidak ditemukan.",
      eventId: randomUUID(),
    },
    404,
    null,
    marker + "-invalid",
  );
  const submissionId = randomUUID(),
    body = {
      category: "pertanyaan",
      subject: marker,
      message:
        "Pesan privat milik pengujian Ruang Jamaah. Mohon informasi agenda kegiatan.",
      wantsReply: true,
      email: person.email,
      phone: person.phone_e164,
      eventId,
      submissionId,
    };
  const results = await Promise.all([
    api(
      "kirim publik paralel A",
      "POST",
      "/api/public/jamaah-room",
      body,
      201,
      null,
    ),
    api(
      "kirim publik paralel B",
      "POST",
      "/api/public/jamaah-room",
      body,
      201,
      null,
    ),
  ]);
  verify(
    "dua kiriman identik satu referensi",
    results[0].reference === results[1].reference,
  );
  const stored = (
    await pool.query(
      "SELECT * FROM jamaah_room_entries WHERE submission_key=$1",
      [submissionId],
    )
  ).rows;
  verify("idempotensi satu baris", stored.length === 1);
  entryId = stored[0].id;
  await api(
    "ulang kiriman aman",
    "POST",
    "/api/public/jamaah-room",
    body,
    201,
    null,
  );
  await api(
    "kunci sama isi berbeda ditolak",
    "POST",
    "/api/public/jamaah-room",
    { ...body, message: body.message + " Berbeda." },
    409,
    null,
  );
  const rateBody = {
    category: "masukan",
    subject: marker + " rate",
    message: "Masukan uji pembatasan kiriman secara aman.",
  };
  for (let i = 0; i < 6; i++)
    await api(
      "batas kiriman " + (i + 1),
      "POST",
      "/api/public/jamaah-room",
      { ...rateBody, submissionId: randomUUID() },
      i < 5 ? 201 : 429,
      null,
      marker + "-rate",
    );
  const found = await api(
    "cari referensi",
    "GET",
    "/api/jamaah-room?search=%23" + results[0].reference,
  );
  verify(
    "referensi ditemukan",
    found.items.some((r: any) => r.id === entryId),
  );
  const candidates = await api(
    "kecocokan kontak",
    "GET",
    "/api/jamaah-room/" + entryId + "/person-candidates",
  );
  verify(
    "kandidat cocok tanpa penautan otomatis",
    candidates.some((r: any) => r.id === personId) &&
      !(
        await api(
          "belum ditautkan otomatis",
          "GET",
          "/api/jamaah-room/" + entryId,
        )
      ).personId,
  );
  await api(
    "CS ambil penanganan",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { status: "reviewing" },
    200,
    "cs_officer",
  );
  await api(
    "petugas lain tidak dapat menimpa",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { internalNote: "Tidak boleh menimpa" },
    403,
    "fundraising_officer",
  );
  await api(
    "CS tidak dapat menugaskan ke orang lain",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    {
      ownerUserId: vault.accounts.find((a) => a.role === "fundraising_officer")!
        .id,
    },
    403,
    "cs_officer",
  );
  let detail = await api(
    "detail PIC",
    "GET",
    "/api/jamaah-room/" + entryId,
    undefined,
    200,
    "cs_officer",
  );
  await api(
    "versi lama ditolak",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    {
      internalNote: "Versi lama",
      expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
    },
    409,
    "cs_officer",
  );
  await api(
    "tautkan profil manual",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    {
      personId,
      reason: "Kontak dan identitas telah dikonfirmasi",
      expectedUpdatedAt: detail.updatedAt,
    },
    200,
    "cs_officer",
  );
  const taskPayload = {
    title: "Konfirmasi agenda jamaah",
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    taskType: "whatsapp",
  };
  const task = await api(
    "buat tugas pesan",
    "POST",
    "/api/jamaah-room/" + entryId + "/tasks",
    taskPayload,
    201,
    "cs_officer",
  );
  await api(
    "cegah dua tugas aktif",
    "POST",
    "/api/jamaah-room/" + entryId + "/tasks",
    taskPayload,
    409,
    "cs_officer",
  );
  await api(
    "cegah menutup tugas belum selesai",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { status: "closed" },
    409,
    "cs_officer",
  );
  await api(
    "cegah arsip tugas belum selesai",
    "DELETE",
    "/api/jamaah-room/" + entryId,
    { reason: "Belum selesai" },
    409,
    "cs_officer",
  );
  const taskList = await api(
    "filter tugas sumber",
    "GET",
    "/api/tasks?roomEntryId=" + entryId,
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "tugas tersambung sumber dan profil",
    taskList.some(
      (t: any) =>
        t.id === task.id &&
        t.relatedId === entryId &&
        t.person?.id === personId,
    ),
  );
  const foreignTasks = await api(
    "tugas pesan disembunyikan dari event admin",
    "GET",
    "/api/tasks?roomEntryId=" + entryId,
    undefined,
    200,
    "event_admin",
  );
  verify("hak tugas tidak membuka pesan privat", foreignTasks.length === 0);
  await api(
    "hapus permanen tugas sumber dicegah",
    "DELETE",
    "/api/tasks/" + task.id,
    undefined,
    409,
  );
  const fund = vault.accounts.find((a) => a.role === "fundraising_officer")!;
  await api(
    "admin pindah PIC tugas dan pesan",
    "POST",
    "/api/tasks/" + task.id + "/reassign",
    { newOwnerUserId: fund.id, reason: "Uji alih penanganan" },
    200,
  );
  detail = await api(
    "detail setelah alih PIC",
    "GET",
    "/api/jamaah-room/" + entryId,
  );
  verify(
    "PIC pesan mengikuti tugas",
    detail.ownerUserId === fund.id && detail.tasks[0].ownerUserId === fund.id,
  );
  await api(
    "selesaikan tugas dari PIC",
    "PATCH",
    "/api/tasks/" + task.id + "/status",
    { status: "completed" },
    200,
    "fundraising_officer",
  );
  const firstComplete = (
    await pool.query("SELECT completed_at FROM tasks WHERE id=$1", [task.id])
  ).rows[0];
  await api(
    "selesai berulang idempoten",
    "PATCH",
    "/api/tasks/" + task.id + "/status",
    { status: "completed" },
    200,
    "fundraising_officer",
  );
  verify(
    "waktu selesai tidak berubah",
    +(await pool.query("SELECT completed_at FROM tasks WHERE id=$1", [task.id]))
      .rows[0].completed_at === +firstComplete.completed_at,
  );
  await api(
    "catat tanggapan",
    "POST",
    "/api/jamaah-room/" + entryId + "/response",
    {
      response:
        "Agenda telah dijelaskan kepada jamaah untuk pengujian staging.",
      replyChannel: "phone_call",
      responseOccurredAt: new Date().toISOString(),
    },
    200,
    "fundraising_officer",
  );
  detail = await api(
    "riwayat tanggapan",
    "GET",
    "/api/jamaah-room/" + entryId,
    undefined,
    200,
    "fundraising_officer",
  );
  const responseLog = detail.activity.find(
    (a: any) => a.action === "response_recorded",
  );
  verify(
    "status dan jejak interaksi tersambung",
    detail.status === "responded" && !!responseLog?.interactionId,
  );
  const interaction = await api(
    "interaksi hasil tanggapan",
    "GET",
    "/api/interactions/" + responseLog.interactionId,
    undefined,
    200,
    "fundraising_officer",
  );
  verify(
    "interaksi terbatas punya tautan balik",
    interaction.roomEntryId === entryId &&
      interaction.personId === personId &&
      interaction.sensitivityLevel === "restricted" &&
      !interaction.summary.includes(body.message),
  );
  const profile = await api(
    "profil dengan pesan terkait",
    "GET",
    "/api/persons/" + personId,
    undefined,
    200,
    "fundraising_officer",
  );
  await api(
    "tugas tanggapan harus dari pesan asal",
    "POST",
    "/api/interactions/" + interaction.id + "/follow-up",
    {
      nextAction: "Tindak lanjut kedua",
      taskDueAt: new Date(Date.now() + 86400000).toISOString(),
    },
    409,
    "fundraising_officer",
  );
  await api(
    "koreksi tanggapan harus melalui pesan asal",
    "PATCH",
    "/api/interactions/" + interaction.id,
    { summary: "Tidak boleh terpisah dari pesan" },
    409,
    "fundraising_officer",
  );
  const cs = vault.accounts.find((account) => account.role === "cs_officer")!;
  await api(
    "pindah PIC sesudah tanggapan",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { ownerUserId: cs.id },
  );
  const reassignedInteraction = await api(
    "PIC baru dapat membaca tanggapan terkait",
    "GET",
    "/api/interactions/" + interaction.id,
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "PIC interaksi mengikuti pesan",
    reassignedInteraction.ownerUserId === cs.id,
  );
  await api("kembalikan PIC skenario", "PATCH", "/api/jamaah-room/" + entryId, {
    ownerUserId: fund.id,
  });
  /* profile was read before the ownership change and contains only authorized records. */
  const connectedProfile = profile;
  verify(
    "profil terhubung ke pesan dan interaksi",
    connectedProfile.roomEntries.some((r: any) => r.id === entryId) &&
      connectedProfile.interactions.some((r: any) => r.id === interaction.id),
  );
  /* Keep the subsequent workflow under its final responsible staff. */
  const rollbackBefore = (
    await pool.query(
      "SELECT internal_note,updated_at FROM jamaah_room_entries WHERE id=$1",
      [entryId],
    )
  ).rows[0];
  const activityBefore = Number(
    (
      await pool.query(
        "SELECT count(*) FROM jamaah_room_activity WHERE entry_id=$1",
        [entryId],
      )
    ).rows[0].count,
  );
  const trigger = "room_uat_" + Date.now().toString(36);
  try {
    await pool.query(
      `CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='jamaah_room_entry' AND NEW.entity_id='${entryId}'::uuid AND NEW.action='jamaah_room_updated' THEN RAISE EXCEPTION 'UAT atomic rollback'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.${trigger}()`,
    );
    const originalError = console.error;
    try {
      console.error = () => {};
      await api(
        "audit gagal mengembalikan kegagalan",
        "PATCH",
        "/api/jamaah-room/" + entryId,
        { internalNote: "UAT perubahan yang harus rollback" },
        500,
        "fundraising_officer",
      );
    } finally {
      console.error = originalError;
    }
    const rollbackAfter = (
        await pool.query(
          "SELECT internal_note,updated_at FROM jamaah_room_entries WHERE id=$1",
          [entryId],
        )
      ).rows[0],
      activityAfter = Number(
        (
          await pool.query(
            "SELECT count(*) FROM jamaah_room_activity WHERE entry_id=$1",
            [entryId],
          )
        ).rows[0].count,
      );
    verify(
      "kegagalan audit membatalkan data dan aktivitas dalam transaksi",
      JSON.stringify(rollbackBefore) === JSON.stringify(rollbackAfter) &&
        activityBefore === activityAfter,
    );
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON audit_logs`);
    await pool.query(`DROP FUNCTION IF EXISTS public.${trigger}()`);
  }
  const profileCheck = await api(
    "profil dengan pesan terkait",
    "GET",
    "/api/persons/" + personId,
    undefined,
    200,
    "fundraising_officer",
  );
  verify(
    "profil terhubung ke pesan dan interaksi",
    profileCheck.roomEntries.some((r: any) => r.id === entryId) &&
      profileCheck.interactions.some((r: any) => r.id === interaction.id),
  );
  await api(
    "PIC biasa tidak dapat salah tautkan setelah tanggapan",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { personId: null, reason: "Uji penolakan pelepasan" },
    403,
    "fundraising_officer",
  );
  await api(
    "tutup setelah ditanggapi",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { status: "closed" },
    200,
    "fundraising_officer",
  );
  await api(
    "pemulihan tugas pesan ditutup ditolak",
    "PATCH",
    "/api/tasks/" + task.id + "/status",
    { status: "pending" },
    409,
    "fundraising_officer",
  );
  await api(
    "arsip aman",
    "DELETE",
    "/api/jamaah-room/" + entryId,
    { reason: "Penanganan uji selesai" },
    200,
    "fundraising_officer",
  );
  const archived = await api(
    "antrean arsip",
    "GET",
    "/api/jamaah-room?archive=archived&search=" + encodeURIComponent(marker),
  );
  verify(
    "arsip dapat ditemukan",
    archived.items.some((r: any) => r.id === entryId),
  );
  await api(
    "arsip tidak dapat ditimpa",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { internalNote: "Tidak boleh" },
    409,
    "fundraising_officer",
  );
  await api(
    "pulihkan arsip",
    "POST",
    "/api/jamaah-room/" + entryId + "/restore",
    { reason: "Uji pemulihan" },
    200,
    "fundraising_officer",
  );
  await api(
    "buka kembali pesan",
    "PATCH",
    "/api/jamaah-room/" + entryId,
    { status: "reviewing" },
    200,
    "fundraising_officer",
  );
  await api(
    "pulihkan tugas aktif",
    "PATCH",
    "/api/tasks/" + task.id + "/status",
    { status: "pending" },
    200,
    "fundraising_officer",
  );
  await api(
    "batalkan tugas",
    "PATCH",
    "/api/tasks/" + task.id + "/status",
    { status: "cancelled" },
    200,
    "fundraising_officer",
  );
  const storyNonce = randomUUID();
  await api(
    "cerita berizin",
    "POST",
    "/api/public/jamaah-room",
    {
      category: "cerita",
      subject: marker + " cerita",
      message:
        "Pesan asli privat cerita yang tidak boleh otomatis ditampilkan.",
      publicationConsent: true,
      anonymousPublication: true,
      submissionId: storyNonce,
    },
    201,
    null,
    marker + "-story",
  );
  storyId = (
    await pool.query(
      "SELECT id FROM jamaah_room_entries WHERE submission_key=$1",
      [storyNonce],
    )
  ).rows[0].id;
  await api(
    "cegah publikasi kontak",
    "PATCH",
    "/api/jamaah-room/" + storyId,
    {
      published: true,
      publicTitle: "Cerita kajian",
      publicText: "Silakan hubungi 081234567890 untuk cerita ini.",
    },
    400,
  );
  await api("simpan draf kurasi", "PATCH", "/api/jamaah-room/" + storyId, {
    publicTitle: "Perjalanan mengikuti kajian",
    publicText:
      "Saya datang ke kajian dan mendapatkan teman belajar yang baik.",
  });
  const prior = await api(
    "cerita draf tersembunyi",
    "GET",
    "/api/public/jamaah-room/stories",
    undefined,
    200,
    null,
  );
  verify("draf tidak tampil publik", !prior.some((r: any) => r.id === storyId));
  await api(
    "terbitkan cerita sintetis",
    "PATCH",
    "/api/jamaah-room/" + storyId,
    { published: true },
  );
  let stories = await api(
      "cerita publik aman",
      "GET",
      "/api/public/jamaah-room/stories",
      undefined,
      200,
      null,
    ),
    published = stories.find((r: any) => r.id === storyId);
  verify(
    "publik hanya menerima kurasi dan nama samaran",
    published?.displayName === "Jamaah YTS" &&
      published.message !==
        "Pesan asli privat cerita yang tidak boleh otomatis ditampilkan." &&
      !("email" in published) &&
      !("phone" in published) &&
      !("internalNote" in published),
  );
  await pool.query(
    "UPDATE jamaah_room_entries SET public_text=$2 WHERE id=$1",
    [
      storyId,
      "Kontak lama 081234567890 tidak boleh tampil pada halaman publik.",
    ],
  );
  stories = await api(
    "pertahanan konten lama",
    "GET",
    "/api/public/jamaah-room/stories",
    undefined,
    200,
    null,
  );
  verify(
    "kontak dari data lama tersaring saat baca",
    !stories.some((r: any) => r.id === storyId),
  );
  await api("tarik publikasi", "PATCH", "/api/jamaah-room/" + storyId, {
    published: false,
  });
  stories = await api(
    "penarikan langsung berlaku",
    "GET",
    "/api/public/jamaah-room/stories",
    undefined,
    200,
    null,
  );
  verify(
    "cerita tidak tampil setelah ditarik",
    !stories.some((r: any) => r.id === storyId),
  );
  const noConsentNonce = randomUUID();
  await api(
    "cerita tanpa izin",
    "POST",
    "/api/public/jamaah-room",
    {
      category: "cerita",
      subject: marker + " privat",
      message: "Cerita pengujian ini tetap privat tanpa izin publikasi.",
      submissionId: noConsentNonce,
    },
    201,
    null,
    marker + "-private",
  );
  const noConsentId = (
    await pool.query(
      "SELECT id FROM jamaah_room_entries WHERE submission_key=$1",
      [noConsentNonce],
    )
  ).rows[0].id;
  await api(
    "publikasi tanpa izin ditolak",
    "PATCH",
    "/api/jamaah-room/" + noConsentId,
    {
      published: true,
      publicTitle: "Cerita privat",
      publicText: "Cerita ini tidak boleh dipublikasikan tanpa izin pemilik.",
    },
    403,
  );
  await api(
    "bulk beberapa pesan",
    "PATCH",
    "/api/jamaah-room/bulk-review",
    { ids: [storyId, noConsentId] },
    200,
    "cs_officer",
  );
  const csv = await api("ekspor beralasan", "POST", "/api/jamaah-room/export", {
    filters: { search: marker },
    reason: "Verifikasi ekspor Ruang Jamaah",
  });
  verify(
    "CSV sesuai hasil filter",
    csv.count >= 3 && csv.csv.includes("Referensi"),
  );
  const audit = (
    await pool.query(
      "SELECT before_json,after_json FROM audit_logs WHERE entity_type='jamaah_room_entry' AND entity_id=$1",
      [entryId],
    )
  ).rows;
  verify(
    "audit global tidak menyalin isi privat",
    audit.length > 0 &&
      !JSON.stringify(audit).includes(body.message) &&
      !JSON.stringify(audit).includes("Agenda telah dijelaskan"),
  );
  const primary = (
    await pool.query("INSERT INTO persons(full_name) VALUES($1) RETURNING id", [
      marker + " utama",
    ])
  ).rows[0];
  await api(
    "merge profil dengan relasi pesan",
    "POST",
    "/api/data-quality/merge",
    {
      primaryPersonId: primary.id,
      secondaryPersonId: personId,
      reason: "Uji seluruh relasi Ruang Jamaah",
    },
  );
  const merged = (
    await pool.query(
      "SELECT r.person_id,t.person_id task_person,i.person_id interaction_person FROM jamaah_room_entries r JOIN tasks t ON t.related_id=r.id JOIN jamaah_room_activity a ON a.entry_id=r.id AND a.interaction_id IS NOT NULL JOIN interactions i ON i.id=a.interaction_id WHERE r.id=$1",
      [entryId],
    )
  ).rows[0];
  verify(
    "merge menjaga pesan tugas dan interaksi",
    merged?.person_id === primary.id &&
      merged.task_person === primary.id &&
      merged.interaction_person === primary.id,
  );
  personId = primary.id;
} catch (e) {
  error = (e as Error).message;
  process.exitCode = 1;
} finally {
  const after = new Map(
    (await retryConnectionRead(hashes).catch(() => [])).map((r: any) => [
      r.table_name + ":" + r.row_hash,
      r.copies,
    ]),
  );
  const preserved =
    before.length > 0 &&
    before.every(
      (r) =>
        Number(after.get(r.table_name + ":" + r.row_hash) || 0) >= r.copies,
    );
  checks.push({
    feature: "seluruh baris bisnis lama tetap utuh",
    passed: preserved,
  });
  const report = {
    environment: "staging",
    at: new Date().toISOString(),
    marker,
    entryId,
    personId,
    eventId,
    storyId,
    total: checks.length,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
    oldBusinessRowsPreserved: preserved,
    error,
    checks,
  };
  saveReport("staging-room-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((c) => !c.passed) }),
  );
  if (report.failed) process.exitCode = 1;
  const { getDbPool } = await import("../server/db/client");
  await getDbPool().end();
  await pool.end();
}
