import { randomUUID } from "node:crypto";
import {
  environmentArg,
  prepareEnvironment,
  readVault,
  saveReport,
  fingerprint,
  targets,
} from "./access-runtime";
import {
  hasPermission,
  PERMISSIONS as P,
  type RoleCode,
} from "../server/permissions/constants";
import { publicRoomTextSafe } from "../src/lib/jamaahRoomModel";
const environment = environmentArg(),
  baseUrl = process.argv[process.argv.indexOf("--base-url") + 1];
if (
  baseUrl !==
  (environment === "production"
    ? "https://app.yts.web.id"
    : targets.staging.previewUrl)
)
  throw new Error("Target HTTPS belum diverifikasi.");
const vault = readVault(environment);
if (!vault) throw new Error("Vault staf tidak tersedia.");
const pool = prepareEnvironment(environment, vault);
pool.on("error", () => {});
const tables = [...targets.legacyTables, "jamaah_room_activity"].filter(
  (t) => !["app_users", "audit_logs"].includes(t),
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
  expected: number,
  token?: string,
  body?: unknown,
  method?: string,
) {
  const response = await fetch(new URL(path, baseUrl), {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
    }),
    json = (await response.json().catch(() => null)) as any,
    passed = response.status === expected && !!json;
  checks.push({ role, feature, passed, actual: response.status });
  return passed && response.ok ? json : null;
}
try {
  const before = await fingerprint(pool, tables);
  let sampleId = randomUUID();
  await request(
    "anonymous",
    "inbox privat memerlukan login",
    "/api/jamaah-room",
    401,
  );
  await request(
    "anonymous",
    "kiriman tidak valid tidak disimpan",
    "/api/public/jamaah-room",
    400,
    undefined,
    { category: "saran", subject: "Pendek", message: "short" },
  );
  const publicStories = await request(
    "anonymous",
    "cerita publik",
    "/api/public/jamaah-room/stories",
    200,
  );
  if (publicStories?.data)
    verify(
      "anonymous",
      "publik hanya menerima kurasi aman",
      Array.isArray(publicStories.data) &&
        publicStories.data.length <= 12 &&
        publicStories.data.every(
          (story: any) =>
            publicRoomTextSafe(story.subject, story.message) &&
            Object.keys(story).every((key) =>
              [
                "id",
                "subject",
                "message",
                "displayName",
                "eventTitle",
                "publishedAt",
              ].includes(key),
            ),
        ),
    );
  const event = (
    await pool.query("SELECT id FROM events ORDER BY created_at DESC LIMIT 1")
  ).rows[0];
  if (event) {
    const info = await request(
      "anonymous",
      "konteks event publik",
      "/api/public/jamaah-room/event/" + event.id,
      200,
    );
    if (info?.data)
      verify(
        "anonymous",
        "konteks event tidak membuka konfigurasi staf",
        Object.keys(info.data).sort().join(",") === "id,title",
      );
  }
  await request(
    "anonymous",
    "ID konteks invalid ditolak",
    "/api/public/jamaah-room/event/invalid",
    400,
  );
  for (const account of [...vault.accounts].sort(
    (a, b) => Number(b.role === "crm_admin") - Number(a.role === "crm_admin"),
  )) {
    const role = account.role,
      allowed = (permission: Parameters<typeof hasPermission>[1]) =>
        hasPermission([role as RoleCode], permission),
      login = await request(
        role,
        "login staf",
        "/api/auth/login",
        200,
        undefined,
        { email: account.email, password: account.password },
      );
    if (!login?.data?.token) continue;
    const token = login.data.token;
    await request(role, "sesi staf", "/api/auth/me", 200, token);
    const list = await request(
      role,
      "antrean dan ringkasan",
      "/api/jamaah-room?pageSize=1",
      allowed(P.INTERACTIONS_VIEW) ? 200 : 403,
      token,
    );
    if (list?.data) {
      verify(
        role,
        "daftar memiliki paging dan pilihan staf",
        Array.isArray(list.data.items) &&
          Array.isArray(list.data.summary) &&
          Array.isArray(list.data.staffOptions) &&
          Number(list.meta?.pageSize) === 1,
      );
      if (list.data.items[0]) sampleId = list.data.items[0].id;
    }
    const exists = Boolean(
      (
        await pool.query("SELECT id FROM jamaah_room_entries WHERE id=$1", [
          sampleId,
        ])
      ).rows[0],
    );
    const detail = await request(
      role,
      "detail pesan",
      "/api/jamaah-room/" + sampleId,
      allowed(P.INTERACTIONS_VIEW) ? (exists ? 200 : 404) : 403,
      token,
    );
    if (detail?.data)
      verify(
        role,
        "detail privat tanpa kunci pengiriman",
        !("submissionKey" in detail.data) &&
          !("submissionDigest" in detail.data) &&
          Array.isArray(detail.data.activity) &&
          Array.isArray(detail.data.tasks),
      );
    await request(
      role,
      "pencocokan profil",
      "/api/jamaah-room/" + sampleId + "/person-candidates",
      allowed(P.INTERACTIONS_VIEW) ? (exists ? 200 : 404) : 403,
      token,
    );
    await request(
      role,
      "validasi filter sebelum membaca",
      "/api/jamaah-room?status=invalid",
      allowed(P.INTERACTIONS_VIEW) ? 400 : 403,
      token,
    );
    for (const [feature, path, method] of [
      ["ubah", "", "PATCH"],
      ["arsip", "", "DELETE"],
      ["pulihkan", "/restore", "POST"],
      ["tugas", "/tasks", "POST"],
      ["tanggapan", "/response", "POST"],
    ] as const) {
      await request(
        role,
        "validasi " + feature + " tanpa perubahan",
        "/api/jamaah-room/" + sampleId + path,
        allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
        token,
        {},
        method,
      );
    }
    await request(
      role,
      "validasi penanganan massal tanpa perubahan",
      "/api/jamaah-room/bulk-review",
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
      "PATCH",
    );
    await request(
      role,
      "ekspor memerlukan izin dan alasan",
      "/api/jamaah-room/export",
      allowed(P.INTERACTIONS_VIEW) && allowed(P.DATA_EXPORT) ? 400 : 403,
      token,
      {},
    );
    const tasks = await request(
      role,
      "tugas konteks sumber",
      "/api/tasks?roomEntryId=" + sampleId,
      allowed(P.TASKS_VIEW_OWN) || allowed(P.TASKS_VIEW_ALL) ? 200 : 403,
      token,
    );
    if (Array.isArray(tasks?.data) && !allowed(P.INTERACTIONS_VIEW))
      verify(
        role,
        "tugas privat tidak melewati izin pesan",
        tasks.data.length === 0,
      );
  }
  await request(
    "anonymous",
    "detail pesan memerlukan login",
    "/api/jamaah-room/" + sampleId,
    401,
  );
  const unchanged =
    JSON.stringify(before) === JSON.stringify(await fingerprint(pool, tables));
  verify("database", "seluruh tabel bisnis tetap sama", unchanged);
  const report = {
    environment,
    baseUrl,
    at: new Date().toISOString(),
    total: checks.length,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
    comparedBusinessTables: tables.length,
    businessTablesUnchanged: unchanged,
    checks,
  };
  saveReport(environment + "-room-https-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((c) => !c.passed) }),
  );
  if (report.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
