import { readFileSync } from "node:fs";
import {
  environmentArg,
  prepareEnvironment,
  fingerprint,
  saveReport,
  targets,
} from "./access-runtime";
const environment = environmentArg(),
  pool = prepareEnvironment(environment);
pool.on("error", () => {});
async function existingValues() {
  const names = targets.legacyTables as string[];
  return (
    await pool.query(
      names
        .map((name) => {
          if (!/^[a-z_]+$/.test(name))
            throw new Error("Nama tabel tidak valid.");
          const row =
            name === "jamaah_room_entries"
              ? "to_jsonb(r)-ARRAY['person_id','owner_user_id','response_recorded_at','reply_channel','archived_at','archived_by','archive_reason','submission_key','submission_digest']"
              : "to_jsonb(r)";
          return `SELECT '${name}'::text table_name,count(*)::int row_count,md5(coalesce(string_agg(md5((${row})::text),'' ORDER BY md5((${row})::text)),'')) fingerprint FROM public."${name}" r`;
        })
        .join(" UNION ALL "),
    )
  ).rows.sort((a: any, b: any) => a.table_name.localeCompare(b.table_name));
}
try {
  const before = await existingValues(),
    connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL lock_timeout='5s'");
    await connection.query(
      readFileSync("drizzle/0017_jamaah_room_connections.sql", "utf8"),
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
  const after = await fingerprint(pool, [
    ...targets.legacyTables,
    "jamaah_room_activity",
  ]);
  saveReport(`${environment}-room-connections-migration.json`, {
    environment,
    migration: "0017",
    at: new Date().toISOString(),
    existingValuesPreserved: preserved,
    before,
    after,
  });
  console.log(
    JSON.stringify({
      environment,
      migration: "0017",
      existingValuesPreserved: preserved,
      comparedTables: before.length,
    }),
  );
} finally {
  await pool.end();
}
