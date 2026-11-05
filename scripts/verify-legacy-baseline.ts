import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { environmentArg, fingerprint, prepareEnvironment, rolloutDirectory, saveReport } from './access-runtime';
const environment = environmentArg();
const baseline = JSON.parse(readFileSync(resolve(rolloutDirectory, `${environment}-attendance-migration.json`), 'utf8'));
const expected = baseline.after.filter((row: any) => !['app_users', 'audit_logs'].includes(row.table_name));
const pool = prepareEnvironment(environment);
try {
  const current = await fingerprint(pool, expected.map((row: any) => row.table_name));
  const differences = expected.filter((row: any) => JSON.stringify(row) !== JSON.stringify(current.find((item) => item.table_name === row.table_name)));
  const report = { checkedAt: new Date().toISOString(), environment, baseline: 'after attendance migration 0013', comparedTables: expected.length, preservedTables: expected.length - differences.length, businessRowsUnchanged: !differences.length, changedTables: differences.map((row: any) => row.table_name) };
  saveReport(`${environment}-legacy-baseline-verification.json`, report); console.log(JSON.stringify(report));
  if (differences.length) process.exitCode = 1;
} finally { await pool.end(); }
