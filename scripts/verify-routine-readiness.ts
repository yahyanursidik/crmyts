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
const environment = environmentArg();
const baseUrl = process.argv[process.argv.indexOf("--base-url") + 1];
if (
  baseUrl !==
  (environment === "production"
    ? "https://app.yts.web.id"
    : targets.staging.previewUrl)
)
  throw new Error("Gunakan URL HTTPS lingkungan YTS yang terverifikasi.");
const vault = readVault(environment);
if (!vault) throw new Error("Vault staf belum tersedia.");
const pool = prepareEnvironment(environment, vault);
pool.on("error", () => {});
const tables = (targets.legacyTables as string[]).filter(
  (table) => !["app_users", "audit_logs"].includes(table),
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
) {
  const response = await fetch(new URL(path, baseUrl), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as any;
  const passed = response.status === expected && !!json;
  checks.push({ role, feature, passed, actual: response.status });
  return passed ? json?.data : null;
}
try {
  const before = await fingerprint(pool, tables);
  await request(
    "anonymous",
    "seri memerlukan login",
    "/api/kajian-rutin/series",
    401,
  );
  let seriesId = "",
    sessionId = "";
  for (const account of [...vault.accounts].sort(
    (a, b) => Number(b.role === "crm_admin") - Number(a.role === "crm_admin"),
  )) {
    const role = account.role;
    const allowed = (permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission([role as RoleCode], permission);
    const login = await request(
      role,
      "login staf",
      "/api/auth/login",
      200,
      undefined,
      { email: account.email, password: account.password },
    );
    if (!login?.token) continue;
    const token = login.token;
    await request(role, "sesi staf", "/api/auth/me", 200, token);
    const series = await request(
      role,
      "direktori seri",
      "/api/kajian-rutin/series",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    if (series)
      seriesId ||= [...series].sort(
        (a: any, b: any) => b.totalAttendance - a.totalAttendance,
      )[0]?.id;
    if (!seriesId) throw new Error("Seri sampel belum tersedia.");
    const detail = await request(
      role,
      "sesi dan QR",
      "/api/kajian-rutin/series/" + seriesId + "/sessions",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    if (detail) {
      sessionId ||= [...detail.sessions].sort(
        (a: any, b: any) => b.attendanceCount - a.attendanceCount,
      )[0]?.id;
      verify(
        role,
        "sesi mempertahankan konteks seri",
        detail.sessions.every((row: any) => row.seriesId === seriesId),
      );
    }
    if (!sessionId) throw new Error("Sesi sampel belum tersedia.");
    const roster = await request(
      role,
      "presensi dan ringkasan",
      "/api/kajian-rutin/sessions/" + sessionId + "/attendance",
      allowed(P.ATTENDANCE_VIEW_SUMMARY) ? 200 : 403,
      token,
    );
    if (roster)
      verify(
        role,
        "ringkasan membatasi data pribadi dan QR",
        allowed(P.ATTENDANCE_MANAGE)
          ? roster.items.filter((row: any) => row.status === "present")
              .length === roster.presentCount
          : roster.summaryOnly &&
              !roster.items.length &&
              !roster.session.qrToken,
      );
    await request(
      role,
      "peringkat kehadiran",
      "/api/kajian-rutin/series/" + seriesId + "/early-birds",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    await request(
      role,
      "master pemateri",
      "/api/kajian-rutin/speakers",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    await request(
      role,
      "pengumuman pengelola",
      "/api/kajian-rutin/announcements",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    await request(
      role,
      "validasi izin perubahan tanpa menulis data",
      "/api/kajian-rutin/series",
      allowed(P.EVENTS_MANAGE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi izin manual tanpa menulis data",
      "/api/kajian-rutin/sessions/" + sessionId + "/attendance",
      allowed(P.ATTENDANCE_MANAGE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi izin ekspor tanpa mengekspor",
      "/api/kajian-rutin/sessions/" + sessionId + "/attendance/export",
      allowed(P.DATA_EXPORT) && allowed(P.ATTENDANCE_MANAGE) ? 400 : 403,
      token,
      { ids: [], reason: "" },
    );
  }
  await request(
    "anonymous",
    "portal me memerlukan sesi",
    "/api/public/kajian-rutin/portal/me",
    401,
  );
  await request(
    "anonymous",
    "pengumuman portal tersedia",
    "/api/public/kajian-rutin/announcements",
    200,
  );
  await request(
    "anonymous",
    "QR salah ditolak",
    "/api/public/kajian-rutin/scan?sesi=" + sessionId + "&t=invalid-uat",
    403,
  );
  const unchanged =
    JSON.stringify(before) === JSON.stringify(await fingerprint(pool, tables));
  verify("database", "seluruh tabel bisnis tetap sama", unchanged);
  const report = {
    environment,
    baseUrl,
    at: new Date().toISOString(),
    total: checks.length,
    passed: checks.filter((row) => row.passed).length,
    failed: checks.filter((row) => !row.passed).length,
    comparedBusinessTables: tables.length,
    businessTablesUnchanged: unchanged,
    sessionsRevoked: false,
    checks,
  };
  saveReport(environment + "-routine-https-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((row) => !row.passed) }),
  );
  if (report.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
