import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { getServerEnv } from '../config/env';
import * as schema from './schema';
import { runInitialSeed } from './seeds/initial';

async function main() {
  console.log('🚀 Running database migration and initial seed...');
  const env = getServerEnv();

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    console.log('📦 Applying DDL migrations from ./drizzle ...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations applied successfully.');

    console.log('🌱 Seeding initial roles, permissions, programs, tags, and users...');
    await runInitialSeed(db);
    console.log('✅ Database is fully seeded and ready to use!');
  } catch (error) {
    console.error('❌ Migration / Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
