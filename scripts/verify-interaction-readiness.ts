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
const environment = environmentArg(),
  baseUrl = process.argv[process.argv.indexOf("--base-url") + 1];
if (
  baseUrl !==
  (environment === "production"
    ? "https://app.yts.web.id"
    : targets.staging.previewUrl)
)
  throw new Error("Gunakan target HTTPS YTS yang terverifikasi.");
const vault = readVault(environment);
if (!vault) throw new Error("Vault staf tidak tersedia.");
const pool = prepareEnvironment(environment, vault);
pool.on("error", () => {});
const tables = (targets.legacyTables as string[]).filter(
  (t) => !["app_users", "audit_logs"].includes(t),
);
const checks: Array<{
  role: string;
  feature: string;
  passed: boolean;
  actual?: number;
}> = [];
const verify = (role: string, feature: string, passed: boolean) =>
  checks.push({ role, feature, passed });
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
  });
  const json = (await response.json().catch(() => null)) as any;
  const passed = response.status === expected && !!json;
  checks.push({ role, feature, passed, actual: response.status });
  return passed ? json : null;
}
try {
  const before = await fingerprint(pool, tables);
  await request(
    "anonymous",
    "daftar memerlukan login",
    "/api/interactions",
    401,
  );
  let sampleId = "",
    personId = "";
  for (const account of [...vault.accounts].sort(
    (a, b) => Number(b.role === "crm_admin") - Number(a.role === "crm_admin"),
  )) {
    const role = account.role,
      allowed = (permission: Parameters<typeof hasPermission>[1]) =>
        hasPermission([role as RoleCode], permission);
    const login = await request(
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
      "riwayat dan ringkasan",
      "/api/interactions?sensitivityLevel=standard&pageSize=1",
      allowed(P.INTERACTIONS_VIEW) ? 200 : 403,
      token,
    );
    if (list?.data) {
      sampleId ||= list.data[0]?.id;
      personId ||= list.data[0]?.personId;
      verify(
        role,
        "paginasi dan statistik valid",
        Array.isArray(list.data) &&
          list.meta?.pagination?.totalPages >= 1 &&
          list.meta?.stats?.totalAll >= list.data.length,
      );
    }
    if (!sampleId || !personId)
      throw new Error("Catatan standar untuk sampel belum tersedia.");
    await request(
      role,
      "pilihan PIC dan konteks event",
      "/api/interactions/options",
      allowed(P.INTERACTIONS_VIEW) ? 200 : 403,
      token,
    );
    const detail = await request(
      role,
      "detail dan tugas asal",
      "/api/interactions/" + sampleId,
      allowed(P.INTERACTIONS_VIEW) ? 200 : 403,
      token,
    );
    if (detail)
      verify(
        role,
        "detail mempertahankan hubungan Jamaah",
        detail.data?.personId === personId &&
          Array.isArray(detail.data?.followUps),
      );
    if (allowed(P.INTERACTIONS_VIEW))
      await request(
        role,
        "profil Jamaah terhubung",
        "/api/persons/" + personId,
        200,
        token,
      );
    await request(
      role,
      "validasi filter tanpa galat server",
      "/api/interactions?page=bad",
      allowed(P.INTERACTIONS_VIEW) ? 400 : 403,
      token,
    );
    await request(
      role,
      "validasi catat tanpa perubahan",
      "/api/interactions",
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi form profil tanpa perubahan",
      "/api/persons/" + personId + "/interactions",
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi koreksi tanpa perubahan",
      "/api/interactions/" + sampleId,
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
      "PATCH",
    );
    await request(
      role,
      "legacy delete terlindungi dan memerlukan alasan",
      "/api/interactions/" + sampleId,
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
      "DELETE",
    );
    await request(
      role,
      "validasi pemulihan tanpa perubahan",
      "/api/interactions/" + sampleId + "/restore",
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi tugas baru tanpa perubahan",
      "/api/interactions/" + sampleId + "/follow-up",
      allowed(P.INTERACTIONS_CREATE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "ekspor memerlukan izin dan alasan",
      "/api/interactions/export",
      allowed(P.INTERACTIONS_VIEW) && allowed(P.DATA_EXPORT) ? 400 : 403,
      token,
      {},
    );
    const tasks = await request(
      role,
      "tugas menurut konteks asal",
      "/api/tasks?interactionId=" + sampleId,
      allowed(P.TASKS_VIEW_OWN) || allowed(P.TASKS_VIEW_ALL) ? 200 : 403,
      token,
    );
    if (Array.isArray(tasks?.data) && !allowed(P.INTERACTIONS_VIEW))
      verify(
        role,
        "tugas tidak membuka sumber di luar hak akses",
        tasks.data.length === 0,
      );
  }
  await request(
    "anonymous",
    "detail interaksi memerlukan login",
    "/api/interactions/" + sampleId,
    401,
  );
  await request(
    "anonymous",
    "pilihan staf memerlukan login",
    "/api/interactions/options",
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
    passed: checks.filter((r) => r.passed).length,
    failed: checks.filter((r) => !r.passed).length,
    comparedBusinessTables: tables.length,
    businessTablesUnchanged: unchanged,
    checks,
  };
  saveReport(environment + "-interaction-https-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((r) => !r.passed) }),
  );
  if (report.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
