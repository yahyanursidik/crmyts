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
  throw new Error("Mutasi pengujian hanya untuk staging.");
const vault = readVault("staging");
if (!vault) throw new Error("Vault staging tidak tersedia.");
const pool = prepareEnvironment("staging", vault);
pool.on("error", () => {});
process.env.MAILKETING_API_TOKEN = "";
process.env.MAILKETING_API_KEY = "";
const { handler } = await import("../netlify/functions/api");
const marker = "UAT Interaksi " + Date.now().toString(36),
  tokens = new Map<string, string>();
const checks: Array<{ feature: string; passed: boolean; actual?: number }> = [];
let personId = "",
  eventId = "",
  interactionId = "",
  error = "";
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
) {
  const url = new URL(path, "http://localhost");
  const response = await handler({
    path: url.pathname,
    httpMethod: method,
    headers: role ? { authorization: "Bearer " + tokens.get(role) } : {},
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
      feature +
        ": HTTP " +
        response.statusCode +
        "; " +
        (json.error?.message || ""),
    );
  return json.data;
}
const tables = (targets.legacyTables as string[]).filter(
  (t) => !["app_users", "audit_logs"].includes(t),
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
let before: any[] = [];
try {
  before = await retryConnectionRead(hashes);
  for (const account of vault.accounts) {
    const login = await api(
      "login " + account.role,
      "POST",
      "/api/auth/login",
      { email: account.email, password: account.password },
      200,
      null,
    );
    tokens.set(account.role, login.token);
    await api(
      "izin daftar " + account.role,
      "GET",
      "/api/interactions",
      undefined,
      hasPermission([account.role as RoleCode], P.INTERACTIONS_VIEW)
        ? 200
        : 403,
      account.role,
    );
    await api(
      "izin catat " + account.role,
      "POST",
      "/api/interactions",
      {},
      hasPermission([account.role as RoleCode], P.INTERACTIONS_CREATE)
        ? 400
        : 403,
      account.role,
    );
  }
  await api(
    "anonim daftar ditolak",
    "GET",
    "/api/interactions",
    undefined,
    401,
    null,
  );
  const person = (
    await pool.query(
      "INSERT INTO persons(full_name,phone_e164) VALUES($1,$2) RETURNING id",
      [marker, "+62877" + Date.now().toString().slice(-9)],
    )
  ).rows[0];
  personId = person.id;
  const event = await api(
    "buat event konteks",
    "POST",
    "/api/events",
    {
      title: marker,
      speaker: "Pemateri UAT",
      category: "Daurah Khusus",
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() + 93600000).toISOString(),
      deliveryMode: "offline",
      locationName: "Staging",
    },
    201,
  );
  eventId = event.id;
  const base = {
    personId,
    channel: "whatsapp",
    summary: marker + " komunikasi",
    outcome: "minta_dihubungi_kembali",
    sensitivityLevel: "standard",
    createFollowUpTask: false,
  };
  const account = (role: string) =>
    vault.accounts.find((a) => a.role === role)!;
  const standard = await api(
    "catat tanpa membuat tugas terselubung",
    "POST",
    "/api/interactions",
    { ...base, nextAction: "Teks tersisa tidak boleh membuat tugas" },
    201,
    "cs_officer",
  );
  interactionId = standard.interaction.id;
  verify(
    "kotak tugas mati mengabaikan teks tersisa",
    standard.createdTask === null,
  );
  const secret = await api(
    "catatan privat dan tugas atomik",
    "POST",
    "/api/interactions",
    {
      ...base,
      summary: marker + " privat rahasia",
      eventId,
      sensitivityLevel: "restricted",
      createFollowUpTask: true,
      nextAction: "Tindak lanjut privat UAT",
      taskDueAt: new Date(Date.now() + 172800000).toISOString(),
    },
    201,
    "cs_officer",
  );
  verify(
    "tugas menyimpan FK sumber",
    secret.createdTask.relatedType === "interaction" &&
      secret.createdTask.relatedId === secret.interaction.id &&
      secret.createdTask.personId === personId,
  );
  verify(
    "ringkasan privat tidak disalin ke deskripsi tugas",
    !secret.createdTask.description.includes("rahasia"),
  );
  await api(
    "PIC membaca privat",
    "GET",
    "/api/interactions/" + secret.interaction.id,
    undefined,
    200,
    "cs_officer",
  );
  await api(
    "staf lain tidak membaca privat",
    "GET",
    "/api/interactions/" + secret.interaction.id,
    undefined,
    404,
    "fundraising_officer",
  );
  const fundraisingList = await api(
    "pencarian menghormati visibilitas",
    "GET",
    "/api/interactions?search=" + encodeURIComponent(marker),
    undefined,
    200,
    "fundraising_officer",
  );
  verify(
    "daftar hanya memuat catatan standar",
    fundraisingList.length === 1 && fundraisingList[0].id === interactionId,
  );
  const profile = await api(
    "profil Jamaah mengikuti privasi",
    "GET",
    "/api/persons/" + personId,
    undefined,
    200,
    "fundraising_officer",
  );
  verify(
    "profil tidak membocorkan catatan privat",
    profile.interactions.length === 1 &&
      profile.interactions[0].id === interactionId,
  );
  const ownTasks = await api(
    "tugas menerima konteks interaksi",
    "GET",
    "/api/tasks?interactionId=" + secret.interaction.id,
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "tugas memiliki tautan sumber dan kanal benar",
    ownTasks.length === 1 &&
      ownTasks[0].relatedId === secret.interaction.id &&
      ownTasks[0].taskType === "whatsapp",
  );
  verify('draf WhatsApp sesuai tindak lanjut',ownTasks[0].waVisitationMessage.includes('menindaklanjuti')&&!ownTasks[0].waVisitationMessage.includes('bertemu dengan'));
  await api(
    "tugas terkait tidak dihapus permanen",
    "DELETE",
    "/api/tasks/" + secret.createdTask.id,
    undefined,
    409,
    "cs_officer",
  );
  await api(
    "staf tidak bisa menugaskan ke orang lain",
    "POST",
    "/api/interactions",
    { ...base, ownerUserId: account("fundraising_officer").id },
    403,
    "cs_officer",
  );
  await api(
    "pemilik tanpa izin interaksi ditolak",
    "POST",
    "/api/interactions",
    { ...base, ownerUserId: account("finance_verifier").id },
    400,
  );
  for (const [name, body] of Object.entries({
    blank: { summary: "   " },
    date: { occurredAt: "2026-02-30T10:00:00+07:00" },
    future: { occurredAt: new Date(Date.now() + 86400000).toISOString() },
    timezone: { occurredAt: "2026-01-01T10:00" },
    task: { createFollowUpTask: true, nextAction: "" },
    deadline: {
      createFollowUpTask: true,
      nextAction: "Uji tenggat",
      taskDueAt: "bad-date",
    },
  }))
    await api(
      "validasi " + name,
      "POST",
      "/api/interactions",
      { ...base, ...(body as object) },
      400,
      "cs_officer",
    );
  for (const query of [
    "page=abc",
    "pageSize=0",
    "ownerUserId=bad-id",
    "channel=unknown",
    "from=2026-02-30",
    "from=2026-11-09&to=2026-11-01",
  ])
    await api(
      "filter invalid " + query,
      "GET",
      "/api/interactions?" + query,
      undefined,
      400,
      "cs_officer",
    );
  const countBefore = (
    await pool.query(
      "SELECT count(*)::int n FROM interactions WHERE person_id=$1",
      [personId],
    )
  ).rows[0].n;
  await api(
    "Jamaah nonaktif tidak mendapat interaksi baru",
    "DELETE",
    "/api/persons/" + personId,
    { reason: "UAT perlindungan profil" },
    200,
  );
  await api(
    "profil diarsipkan ditolak",
    "POST",
    "/api/interactions",
    base,
    409,
    "cs_officer",
  );
  verify(
    "validasi gagal tidak menambah catatan",
    (
      await pool.query(
        "SELECT count(*)::int n FROM interactions WHERE person_id=$1",
        [personId],
      )
    ).rows[0].n === countBefore,
  );
  await api(
    "pulihkan Jamaah fixture",
    "POST",
    "/api/persons/" + personId + "/restore",
    { reason: "UAT pemulihan profil" },
    200,
  );
  const fromProfile = await api(
    "form profil memakai alur yang sama",
    "POST",
    "/api/persons/" + personId + "/interactions",
    {
      channel: "phone_call",
      summary: marker + " dari profil",
      sensitivityLevel: "standard",
      createFollowUpTask: true,
      nextAction: "Hubungi lagi dari profil",
      taskDueAt: new Date(Date.now() + 172800000).toISOString(),
    },
    201,
    "cs_officer",
  );
  verify(
    "tugas dari profil tertaut",
    fromProfile.createdTask.relatedId === fromProfile.interaction.id,
  );
  await api(
    "staf lain tidak mengoreksi catatan standar",
    "PATCH",
    "/api/interactions/" + interactionId,
    { summary: marker + " upaya ilegal", reason: "Uji larangan" },
    403,
    "fundraising_officer",
  );
  await api(
    "alasan koreksi wajib",
    "PATCH",
    "/api/interactions/" + interactionId,
    { summary: marker + " koreksi" },
    400,
    "cs_officer",
  );
  const corrected = await api(
    "koreksi oleh pencatat",
    "PATCH",
    "/api/interactions/" + interactionId,
    { summary: marker + " hasil koreksi", reason: "Uji pembetulan catatan" },
    200,
    "cs_officer",
  );
  verify(
    "waktu asli tidak bergeser saat koreksi isi",
    corrected.occurredAt === standard.interaction.occurredAt,
  );
  await api(
    "koreksi privat",
    "PATCH",
    "/api/interactions/" + secret.interaction.id,
    { summary: marker + " isi rahasia dikoreksi", reason: "Uji privasi audit" },
    200,
    "cs_officer",
  );
  const audit = (
    await pool.query(
      "SELECT before_json,after_json FROM audit_logs WHERE entity_id=$1 AND action='correct_interaction' ORDER BY created_at DESC LIMIT 1",
      [secret.interaction.id],
    )
  ).rows[0];
  verify(
    "audit tidak menyalin isi privat",
    !JSON.stringify(audit).includes("rahasia"),
  );
  await api(
    "pindahkan tindak lanjut dan PIC",
    "POST",
    "/api/tasks/" + secret.createdTask.id + "/reassign",
    {
      newOwnerUserId: account("fundraising_officer").id,
      reason: "Uji transfer PIC",
    },
    200,
  );
  const moved = await api(
    "PIC baru memperoleh konteks",
    "GET",
    "/api/interactions/" + secret.interaction.id,
    undefined,
    200,
    "fundraising_officer",
  );
  verify(
    "PIC interaksi selaras dengan tugas",
    moved.ownerUserId === account("fundraising_officer").id,
  );
  await api(
    "penerima tidak berizin ditolak sebelum pindah",
    "POST",
    "/api/tasks/" + secret.createdTask.id + "/reassign",
    {
      newOwnerUserId: account("finance_verifier").id,
      reason: "Uji target invalid",
    },
    400,
  );
  verify(
    "penugasan gagal tidak mengubah pemilik",
    (
      await pool.query("SELECT owner_user_id FROM tasks WHERE id=$1", [
        secret.createdTask.id,
      ])
    ).rows[0].owner_user_id === account("fundraising_officer").id,
  );
  await api(
    "selesaikan tindak lanjut",
    "PATCH",
    "/api/tasks/" + secret.createdTask.id + "/status",
    { status: "completed" },
    200,
    "fundraising_officer",
  );
  const completed = await api(
    "detail membaca status terbaru",
    "GET",
    "/api/interactions/" + secret.interaction.id,
    undefined,
    200,
  );
  verify(
    "status tugas kembali ke catatan",
    completed.followUps[0].status === "completed",
  );
  const firstCompletion=(await pool.query('SELECT completed_at FROM tasks WHERE id=$1',[secret.createdTask.id])).rows[0].completed_at.toISOString();
  await api('ulang selesai tetap idempoten','PATCH','/api/tasks/'+secret.createdTask.id+'/status',{status:'completed'},200,'fundraising_officer');
  verify('waktu selesai pertama dipertahankan',(await pool.query('SELECT completed_at FROM tasks WHERE id=$1',[secret.createdTask.id])).rows[0].completed_at.toISOString()===firstCompletion);
  const parallel = await Promise.all(
    [0, 1].map(async (n) => {
      const result = await handler({
        path: "/api/interactions/" + interactionId + "/follow-up",
        httpMethod: "POST",
        headers: { authorization: "Bearer " + tokens.get("cs_officer") },
        queryStringParameters: {},
        body: JSON.stringify({
          nextAction: "Tugas paralel " + n,
          taskDueAt: new Date(Date.now() + 172800000).toISOString(),
        }),
      });
      return result.statusCode;
    }),
  );
  verify(
    "klik paralel menghasilkan satu tugas aktif",
    parallel.filter((n) => n === 201).length === 1 &&
      parallel.filter((n) => n === 409).length === 1,
  );
  const source=await api('baca tugas paralel','GET','/api/interactions/'+interactionId,undefined,200,'cs_officer');
  const firstTaskId=source.followUps[0].id;
  await api('batalkan tugas secara reversibel','PATCH','/api/tasks/'+firstTaskId+'/status',{status:'cancelled'},200,'cs_officer');
  const secondTask=await api('buat tugas baru sesudah pembatalan','POST','/api/interactions/'+interactionId+'/follow-up',{nextAction:'UAT tindak lanjut pengganti',taskDueAt:new Date(Date.now()+172800000).toISOString()},201,'cs_officer');
  await api('pemulihan tidak membuat dua tugas aktif','PATCH','/api/tasks/'+firstTaskId+'/status',{status:'pending'},409,'cs_officer');
  await api('selesaikan tugas pengganti','PATCH','/api/tasks/'+secondTask.id+'/status',{status:'completed'},200,'cs_officer');
  await api('pulihkan tugas setelah antrean kosong','PATCH','/api/tasks/'+firstTaskId+'/status',{status:'pending'},200,'cs_officer');
  await api(
    "catatan bertugas masuk antrean",
    "GET",
    "/api/interactions?personId=" + personId + "&followUp=open",
    undefined,
    200,
    "cs_officer",
  );
  for (const account of vault.accounts) {
    const allowed = hasPermission(
      [account.role as RoleCode],
      P.INTERACTIONS_CREATE,
    );
    if (!allowed)
      await api(
        "penghapusan tanpa izin " + account.role,
        "DELETE",
        "/api/interactions/" + interactionId,
        { reason: "Uji larangan hapus" },
        403,
        account.role,
      );
  }
  await api(
    "staf lain tidak mengarsipkan catatan",
    "DELETE",
    "/api/interactions/" + interactionId,
    { reason: "Uji kepemilikan" },
    403,
    "fundraising_officer",
  );
  await api(
    "arsip memerlukan alasan",
    "DELETE",
    "/api/interactions/" + interactionId,
    {},
    400,
    "cs_officer",
  );
  await api(
    "arsip dapat dipulihkan",
    "DELETE",
    "/api/interactions/" + interactionId,
    { reason: "Uji arsip reversibel" },
    200,
    "cs_officer",
  );
  verify(
    "arsip tidak menghapus baris",
    (
      await pool.query("SELECT archived_at FROM interactions WHERE id=$1", [
        interactionId,
      ])
    ).rows[0]?.archived_at != null,
  );
  const active = await api(
    "daftar aktif mengecualikan arsip",
    "GET",
    "/api/interactions?personId=" + personId,
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "catatan arsip tidak aktif",
    !active.some((r: any) => r.id === interactionId),
  );
  const archived = await api(
    "arsip tetap dapat dicari",
    "GET",
    "/api/interactions?personId=" + personId + "&archive=archived",
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "arsip terlihat pada tab tepat",
    archived.some((r: any) => r.id === interactionId),
  );
  await api(
    "arsip tidak dapat dikoreksi",
    "PATCH",
    "/api/interactions/" + interactionId,
    { summary: "Upaya saat arsip", reason: "Uji keadaan" },
    409,
    "cs_officer",
  );
  await api(
    "pulihkan dengan alasan",
    "POST",
    "/api/interactions/" + interactionId + "/restore",
    { reason: "Uji pemulihan" },
    200,
    "cs_officer",
  );
  const restored = await api(
    "detail pulih",
    "GET",
    "/api/interactions/" + interactionId,
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "pemulihan menjaga tugas",
    !restored.archivedAt && restored.followUps.length === 2,
  );
  const old = await api(
    "waktu historis WIB",
    "POST",
    "/api/interactions",
    {
      ...base,
      summary: marker + " batas WIB",
      occurredAt: "2000-01-01T17:01:00Z",
    },
    201,
    "cs_officer",
  );
  const day = await api(
    "filter hari WIB tepat",
    "GET",
    "/api/interactions?personId=" + personId + "&from=2000-01-02&to=2000-01-02",
    undefined,
    200,
    "cs_officer",
  );
  verify(
    "hari WIB tidak bergeser UTC",
    day.length === 1 && day[0].id === old.interaction.id,
  );
  await api(
    "CSV berizin saja",
    "POST",
    "/api/interactions/export",
    { filters: { personId }, reason: "UAT ekspor" },
    403,
    "cs_officer",
  );
  const exported = await api(
    "ekspor hasil filter",
    "POST",
    "/api/interactions/export",
    {
      filters: { personId, channel: "phone_call" },
      reason: "UAT ekspor terpilih",
    },
    200,
  );
  verify(
    "CSV menghormati kanal dan jumlah",
    exported.count === 1 &&
      exported.csv.includes("phone_call") &&
      !exported.csv.includes("rahasia"),
  );
  await api(
    "riwayat interaksi mencegah hapus event",
    "DELETE",
    "/api/events/" + eventId,
    undefined,
    409,
  );
  const primary = (
    await pool.query(
      "INSERT INTO persons(full_name,phone_e164) VALUES($1,$2) RETURNING id",
      [marker + " Utama", "+62878" + Date.now().toString().slice(-9)],
    )
  ).rows[0];
  await api(
    "merge mempertahankan sumber tindak lanjut",
    "POST",
    "/api/data-quality/merge",
    {
      primaryPersonId: primary.id,
      secondaryPersonId: personId,
      reason: "Uji relasi interaksi dan tugas",
    },
    200,
  );
  const afterMerge = (
    await pool.query(
      "SELECT i.person_id,t.person_id task_person,t.related_id FROM interactions i JOIN tasks t ON t.related_type='interaction' AND t.related_id=i.id WHERE i.id=$1",
      [interactionId],
    )
  ).rows[0];
  verify(
    "interaksi dan tugas mengikuti Jamaah utama",
    afterMerge?.person_id === primary.id &&
      afterMerge.task_person === primary.id &&
      afterMerge.related_id === interactionId,
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
    personId,
    eventId,
    interactionId,
    total: checks.length,
    passed: checks.filter((r) => r.passed).length,
    failed: checks.filter((r) => !r.passed).length,
    oldBusinessRowsPreserved: preserved,
    error,
    checks,
  };
  saveReport("staging-interaction-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((r) => !r.passed) }),
  );
  if (report.failed) process.exitCode = 1;
  const { getDbPool } = await import("../server/db/client");
  await getDbPool().end();
  await pool.end();
}
