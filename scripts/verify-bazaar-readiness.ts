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
    "direktori pengelola terlindungi",
    "/api/bazaar/overview",
    401,
  );
  let eventId = "",
    tenantId = "";
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
    const overview = await request(
      role,
      "direktori dan ringkasan bazar",
      "/api/bazaar/overview",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    if (overview) eventId ||= overview.find((event: any) => event.bazaar)?.id;
    if (!eventId) throw new Error("Bazar sampel belum tersedia.");
    const tenants = await request(
      role,
      "master tenant",
      "/api/bazaar/tenants",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    if (tenants) tenantId ||= tenants[0]?.id;
    if (!tenantId) throw new Error("Tenant sampel belum tersedia.");
    await request(
      role,
      "profil dan riwayat tenant",
      "/api/bazaar/tenants/" + tenantId,
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    const path = "/api/events/" + eventId + "/bazaar";
    const detail = await request(
      role,
      "pengaturan dan stan",
      path,
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    if (detail)
      verify(
        role,
        "konteks event konsisten",
        detail.bazaar?.eventId === eventId,
      );
    await request(
      role,
      "seleksi dan tagihan",
      path + "/applications",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    await request(
      role,
      "insiden operasional",
      path + "/incidents",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    await request(
      role,
      "survei dan evaluasi",
      path + "/surveys",
      allowed(P.EVENTS_VIEW) ? 200 : 403,
      token,
    );
    await request(
      role,
      "validasi izin pembuatan stan tanpa perubahan",
      path + "/booths/bulk",
      allowed(P.EVENTS_MANAGE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi izin impor tanpa perubahan",
      "/api/bazaar/tenants/import-legacy",
      allowed(P.EVENTS_MANAGE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi izin presensi tanpa perubahan",
      path + "/check-in",
      allowed(P.ATTENDANCE_MANAGE) ? 400 : 403,
      token,
      {},
    );
    await request(
      role,
      "validasi izin ekspor tanpa ekspor",
      path + "/export",
      allowed(P.EVENTS_MANAGE) ? 400 : 403,
      token,
      {},
    );
  }
  await request("anonymous", "direktori publik", "/api/public/bazaars", 200);
  const publicData = await request(
    "anonymous",
    "katalog publik",
    "/api/public/events/" + eventId + "/bazaar",
    200,
  );
  if (publicData) {
    const bazaar = publicData.bazaar;
    verify(
      "anonymous",
      "katalog tidak membocorkan dokumen atau kontak PIC",
      (bazaar.showcaseTenants || []).every(
        (tenant: any) =>
          !tenant.picName &&
          !tenant.picPhone &&
          !tenant.picEmail &&
          !tenant.ktpFileUrl &&
          !tenant.applicationId,
      ),
    );
    verify(
      "anonymous",
      "instruksi transfer hanya untuk rekening aktif",
      bazaar.paymentConfigured ||
        (!bazaar.bankName &&
          !bazaar.bankAccountNumber &&
          !bazaar.bankAccountName &&
          !bazaar.paymentInstructions),
    );
  }
  await request(
    "anonymous",
    "status pribadi memerlukan kode",
    "/api/public/events/" + eventId + "/bazaar/check-status?phone=08123456789",
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
  saveReport(environment + "-bazaar-https-verification.json", report);
  console.log(
    JSON.stringify({ ...report, checks: checks.filter((r) => !r.passed) }),
  );
  if (report.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
