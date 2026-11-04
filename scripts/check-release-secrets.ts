import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import { readVault } from './access-runtime';

const secrets: string[] = [];
for (const file of ['.env', '.env.local']) {
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(dotenv.parse(readFileSync(file)))) {
    if (/SECRET|PASSWORD|TOKEN|ACCESS_KEY|DATABASE_URL/.test(key) && value.length >= 16) secrets.push(value);
  }
}
for (const environment of ['staging','production']) {
  const vault = readVault(environment);
  if (vault) secrets.push(vault.authSecret, ...vault.accounts.map((account) => account.password));
}
const configPath = join(process.env.APPDATA!, 'netlify/Config/config.json');
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const active = config.users?.[config.userId];
  const token = typeof active?.auth === 'string' ? active.auth : active?.auth?.token;
  if (token) secrets.push(token);
}
const files = execFileSync('git', ['ls-files', '-m', '-o', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter((file) => file && !file.startsWith('.vite-local.'));
for (const filename of readdirSync('dist/assets')) if (filename.endsWith('.js')) files.push(`dist/assets/${filename}`);
const violations: string[] = [];
for (const file of files) {
  if (!statSync(file).isFile()) continue;
  const text = readFileSync(file, 'utf8');
  if (secrets.some((secret) => text.includes(secret))) violations.push(file);
}
if (violations.length) throw new Error(`Rahasia ditemukan di ${violations.join(', ')}`);
console.log(JSON.stringify({ filesChecked: files.length, plaintextSecretsAbsent: true }));
