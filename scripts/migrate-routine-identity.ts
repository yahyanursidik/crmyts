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
            name === "kajian_rutin_attendance"
              ? "to_jsonb(r)-'person_id'"
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
      readFileSync("drizzle/0014_routine_person_identity.sql", "utf8"),
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
  saveReport(`${environment}-routine-identity-migration.json`, {
    environment,
    migration: "0014",
    at: new Date().toISOString(),
    existingValuesPreserved: preserved,
    before,
    after,
  });
  console.log(
    JSON.stringify({
      environment,
      migration: "0014",
      existingValuesPreserved: true,
      comparedTables: before.length,
    }),
  );
} finally {
  await pool.end();
}
