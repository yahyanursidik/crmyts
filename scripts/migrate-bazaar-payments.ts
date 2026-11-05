import { readFileSync } from "node:fs";
import {
  environmentArg,
  prepareEnvironment,
  fingerprint,
  saveReport,
  targets,
} from "./access-runtime";
const environment = environmentArg();
const pool = prepareEnvironment(environment);
pool.on("error", () => {});
async function existingValues() {
  const tables = targets.legacyTables as string[];
  return (
    await pool.query(
      tables
        .map((name) => {
          if (!/^[a-z_]+$/.test(name))
            throw new Error("Nama tabel tidak valid.");
          const row =
            name === "bazaar_events"
              ? "to_jsonb(r)-'payment_enabled'"
              : "to_jsonb(r)";
          return `SELECT '${name}'::text table_name,count(*)::int row_count,md5(coalesce(string_agg(md5((${row})::text),'' ORDER BY md5((${row})::text)),'')) fingerprint FROM public."${name}" r`;
        })
        .join(" UNION ALL "),
    )
  ).rows.sort((a: any, b: any) => a.table_name.localeCompare(b.table_name));
}
try {
  const before = await existingValues();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL lock_timeout='5s'");
    await connection.query(
      readFileSync("drizzle/0015_bazaar_payment_activation.sql", "utf8"),
    );
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
  const preserved =
    JSON.stringify(before) === JSON.stringify(await existingValues());
  if (!preserved)
    throw new Error("Nilai lama berubah; hentikan rollout untuk pemeriksaan.");
  const after = await fingerprint(pool);
  saveReport(`${environment}-bazaar-payment-migration.json`, {
    environment,
    migration: "0015",
    at: new Date().toISOString(),
    existingValuesPreserved: preserved,
    before,
    after,
  });
  console.log(
    JSON.stringify({
      environment,
      migration: "0015",
      existingValuesPreserved: true,
      comparedTables: before.length,
    }),
  );
} finally {
  await pool.end();
}
