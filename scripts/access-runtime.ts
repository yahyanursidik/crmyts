import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import dotenv from 'dotenv';

export interface AccessAccount { id: string; email: string; fullName: string; role: string; password: string; created: boolean; }
export interface AccessVault { environment: 'staging' | 'production'; databaseHost: string; authSecret: string; createdAt: string; accounts: AccessAccount[]; }
export const rolloutDirectory = resolve('scratch/access-rollout');
mkdirSync(rolloutDirectory, { recursive: true });
export const targets = JSON.parse(readFileSync(resolve(rolloutDirectory, 'targets.json'), 'utf8'));
export function environmentArg(): 'staging' | 'production' {
  const value = process.argv[process.argv.indexOf('--environment') + 1];
  if (!['staging', 'production'].includes(value)) throw new Error('--environment staging atau production wajib dipilih.');
  return value as 'staging' | 'production';
}
export function vaultPath(environment: string) { return resolve(rolloutDirectory, `${environment}-credentials.dpapi`); }
export function vaultOperation<T>(action: 'Protect' | 'Read', environment: string, data?: T): T | undefined {
  const source = readFileSync(resolve('scripts/staff-access-vault.ps1'), 'utf8');
  const command = '$Action = $env:YTS_VAULT_ACTION; $Path = $env:YTS_VAULT_PATH;\n' + source.slice(source.indexOf('$ErrorActionPreference'));
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { input: data ? JSON.stringify(data) : undefined, encoding: 'utf8', env: { ...process.env, YTS_VAULT_ACTION: action, YTS_VAULT_PATH: vaultPath(environment) }, windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Penyimpanan kredensial terenkripsi gagal (${action}).`);
  return action === 'Read' ? JSON.parse(result.stdout) as T : undefined;
}
export function readVault(environment: string): AccessVault | null { return existsSync(vaultPath(environment)) ? vaultOperation<AccessVault>('Read', environment)! : null; }
export function prepareEnvironment(environment: 'staging' | 'production', vault?: AccessVault) {
  dotenv.config({ path: '.env.local' }); dotenv.config();
  const source = new URL(process.env.DATABASE_URL || '');
  if (![targets.production.read_write_host, targets.production.read_write_pooled_host].includes(source.hostname)) throw new Error('DATABASE_URL tidak cocok dengan project asal yang telah diverifikasi.');
  source.hostname = targets[environment].read_write_host;
  process.env.DATABASE_URL = source.toString(); process.env.DATABASE_URL_DIRECT = source.toString();
  process.env.NODE_ENV = environment === 'production' ? 'production' : 'staging';
  if (vault) process.env.AUTH_SECRET = vault.authSecret;
  neonConfig.webSocketConstructor = WebSocket;
  return new Pool({ connectionString: source.toString(), connectionTimeoutMillis: 20000, max: 4 });
}
export async function fingerprint(pool: Pool, tables: string[] = targets.legacyTables): Promise<Array<{table_name: string; row_count: number; fingerprint: string}>> {
  const parts = tables.map((name) => {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Nama tabel tidak valid.');
    return `SELECT '${name}'::text AS table_name, count(*)::int AS row_count, md5(coalesce(string_agg(md5(to_jsonb(r)::text), '' ORDER BY md5(to_jsonb(r)::text)), '')) AS fingerprint FROM public."${name}" r`;
  });
  return (await pool.query(parts.join(' UNION ALL ') + ' ORDER BY table_name')).rows;
}
export function saveReport(name: string, report: unknown) { writeFileSync(resolve(rolloutDirectory, name), JSON.stringify(report, null, 2) + '\n'); }
