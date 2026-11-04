import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readVault, vaultOperation, vaultPath } from './access-runtime';

export const netlifySite = JSON.parse(readFileSync(resolve('scratch/access-rollout/netlify-site.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(process.env.APPDATA!, 'netlify/Config/config.json'), 'utf8'));
const active = config.users?.[config.userId];
const token = typeof active?.auth === 'string' ? active.auth : active?.auth?.token;
if (!token) throw new Error('Sesi Netlify CLI tidak tersedia.');
export async function netlifyApi(path: string, method = 'GET', data?: unknown) {
  const response = await fetch(`https://api.netlify.com/api/v1${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  if (!response.ok) throw new Error(`Netlify ${method} ${path.split('?')[0]}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
export async function runtimeVariables() {
  return netlifyApi(`/accounts/${netlifySite.accountId}/env?site_id=${netlifySite.id}`) as Promise<Array<{key: string; scopes: string[]; values: Array<{context: string; value: string}>; is_secret?: boolean}>>;
}
export function resolvedProductionValue(variables: Awaited<ReturnType<typeof runtimeVariables>>, key: string) {
  const variable = variables.find((row) => row.key === key);
  return variable?.values.find((row) => row.context === 'production')?.value || variable?.values.find((row) => row.context === 'all')?.value || '';
}

if (process.argv.includes('--activate')) {
  const vault = readVault('production');
  if (!vault) throw new Error('Provisioning produksi belum selesai.');
  const variables = await runtimeVariables();
  if (!existsSync(vaultPath('hosting-runtime-backup'))) vaultOperation('Protect', 'hosting-runtime-backup', { site: netlifySite, capturedAt: new Date().toISOString(), variables });
  const changes = [
    { key: 'AUTH_SECRET', value: vault.authSecret, secret: true },
    { key: 'APP_URL', value: 'https://app.yts.web.id', secret: false },
  ];
  for (const change of changes) {
    const existing = variables.find((row) => row.key === change.key);
    const path = `/accounts/${netlifySite.accountId}/env${existing ? `/${change.key}` : ''}?site_id=${netlifySite.id}`;
    if (existing) await netlifyApi(path, 'PATCH', { context: 'production', value: change.value });
    else await netlifyApi(path, 'POST', [{ key: change.key, scopes: ['functions', 'builds'], values: [{ context: 'production', value: change.value }], is_secret: change.secret }]);
  }
  console.log(JSON.stringify({ site: netlifySite.url, changed: changes.map((row) => row.key), previousConfiguration: 'Dicadangkan terenkripsi', otherVariables: 'Dipertahankan' }));
}
