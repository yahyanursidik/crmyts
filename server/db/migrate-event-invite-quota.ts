import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('Running event invite quota migration on PostgreSQL...');

  try {
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS quota_invite integer,
      ADD COLUMN IF NOT EXISTS quota_invite_ikhwan integer,
      ADD COLUMN IF NOT EXISTS quota_invite_akhwat integer;
    `);
    console.log('✓ events table columns (quota_invite, quota_invite_ikhwan, quota_invite_akhwat) added/verified');

    console.log('Event invite quota migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
