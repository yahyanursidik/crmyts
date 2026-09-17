import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import { drizzle, NeonDatabase } from 'drizzle-orm/neon-serverless';
import { getServerEnv } from '../config/env';
import * as schema from './schema';

let pool: Pool | null = null;
let dbInstance: NeonDatabase<typeof schema> | null = null;

// `Pool` uses WebSocket transport. Browsers and edge runtimes provide one,
// whereas the Node runtime used by local Vite and Netlify functions needs the
// compatible `ws` implementation supplied explicitly by Neon.
neonConfig.webSocketConstructor = WebSocket;

export function getDbPool(): Pool {
  if (!pool) {
    const env = getServerEnv();
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

export function getDb(): NeonDatabase<typeof schema> {
  if (!dbInstance) {
    const p = getDbPool();
    dbInstance = drizzle(p, { schema });
  }
  return dbInstance;
}

export { sql } from 'drizzle-orm';
