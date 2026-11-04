import { readFileSync } from 'node:fs';
import { environmentArg, prepareEnvironment, fingerprint, saveReport } from './access-runtime';
const environment = environmentArg();
const pool = prepareEnvironment(environment);
try {
  const before = await fingerprint(pool);
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query("SET LOCAL lock_timeout = '5s'");
    await connection.query(readFileSync('drizzle/0013_attendance_checkin_nullable.sql','utf8'));
    await connection.query('COMMIT');
  } catch (error) { await connection.query('ROLLBACK'); throw error; }
  finally { connection.release(); }
  const after = await fingerprint(pool);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Fingerprint data berubah; pemeriksaan manual diperlukan sebelum melanjutkan.');
  saveReport(`${environment}-attendance-migration.json`, { environment, migration:'0013', appliedAt:new Date().toISOString(), legacyRowsUnchanged:true, before, after });
  console.log(JSON.stringify({environment,migration:'0013',legacyTablesUnchanged:before.length,existingValuesPreserved:true}));
} finally { await pool.end(); }
