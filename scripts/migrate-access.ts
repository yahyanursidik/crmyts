import { readFile } from 'node:fs/promises';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import { getServerEnv } from '../server/config/env';

async function main() {
  const direct = getServerEnv().DATABASE_URL_DIRECT;
  if (!direct || new URL(direct).hostname.includes('-pooler')) throw new Error('DATABASE_URL_DIRECT harus menunjuk koneksi langsung pada branch staging yang dipilih.');
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: direct });
  try {
    await pool.query(await readFile(new URL('../drizzle/0012_staff_credentials.sql', import.meta.url), 'utf8'));
    console.log('Migrasi akses staf dan pengaturan yayasan selesai. Data lama dipertahankan.');
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Migrasi gagal. Periksa koneksi langsung dan branch database yang dipilih.'); process.exitCode = 1; });
