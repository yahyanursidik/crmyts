import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { runtimeVariables, resolvedProductionValue } from './netlify-runtime';
import { saveReport } from './access-runtime';

const variables = await runtimeVariables();
const googleClientId = resolvedProductionValue(variables, 'VITE_GOOGLE_CLIENT_ID');
if (!googleClientId) throw new Error('Client ID Google produksi belum tersedia untuk bundel portal.');
const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const child = spawn(process.execPath, [npmCli, 'run', 'build'], { env: { ...process.env, VITE_API_BASE_URL: '/api', VITE_GOOGLE_CLIENT_ID: googleClientId, VITE_APP_NAME: 'CRM YTS' }, stdio: 'inherit', windowsHide: true });
const status = await new Promise<number | null>((resolve) => child.on('exit', resolve));
if (status !== 0) process.exit(status || 1);
const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js')).map((name) => readFileSync(resolve('dist/assets', name), 'utf8'));
const bundle = assets.join('\n');
if (bundle.includes('http://localhost:5173/api') || bundle.includes('http://localhost:4321/api') || bundle.includes('postgresql://')) throw new Error('Bundel memuat endpoint lokal atau URL database.');
for (const variable of variables.filter((row) => !row.key.startsWith('VITE_'))) {
  const value = resolvedProductionValue(variables, variable.key);
  if (value.length >= 20 && !['APP_URL','GOOGLE_CLIENT_ID','S3_PUBLIC_URL_PREFIX','S3_ENDPOINT'].includes(variable.key) && bundle.includes(value)) throw new Error(`Nilai server ditemukan di bundel: ${variable.key}`);
}
saveReport('release-build.json', { builtAt: new Date().toISOString(), apiBase: '/api', googleClientIdIncluded: bundle.includes(googleClientId), serverSecretsAbsent: true });
console.log(JSON.stringify({ releaseBuild: 'passed', apiBase: '/api', googleClientIdIncluded: bundle.includes(googleClientId), serverSecretsAbsent: true }));
