import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readVault, targets, vaultOperation, vaultPath } from './access-runtime';
import dotenv from 'dotenv';
const vault = readVault('production');
if (!vault) throw new Error('Vault produksi belum tersedia.');
let content = readFileSync('.env.local', 'utf8');
const values = dotenv.parse(content);
const database = new URL(values.DATABASE_URL);
if (![targets.production.read_write_host, targets.production.read_write_pooled_host].includes(database.hostname)) throw new Error('File lokal tidak menunjuk database produksi yang telah diverifikasi.');
if (!existsSync(vaultPath('local-environment-backup'))) vaultOperation('Protect', 'local-environment-backup', { createdAt: new Date().toISOString(), content });
database.hostname = targets.production.read_write_host;
for (const [key, value] of [['DATABASE_URL_DIRECT', database.toString()], ['AUTH_SECRET', vault.authSecret]]) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  content = pattern.test(content) ? content.replace(pattern, `${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`;
}
writeFileSync('.env.local', content);
console.log(JSON.stringify({ corrected: ['DATABASE_URL_DIRECT','AUTH_SECRET'], databaseBranch: 'production unchanged', previousEnvironment: 'encrypted backup' }));
