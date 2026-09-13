import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('Running event min_age migration on PostgreSQL...');

  try {
    // 1. Add min_age to events
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS min_age integer;
    `);
    console.log('✓ events table column (min_age) added/verified');

    console.log('Event min_age migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
