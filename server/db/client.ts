import { Pool } from '@neondatabase/serverless';
import { drizzle, NeonDatabase } from 'drizzle-orm/neon-serverless';
import { getServerEnv } from '../config/env';
import * as schema from './schema';

let pool: Pool | null = null;
let dbInstance: NeonDatabase<typeof schema> | null = null;

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
