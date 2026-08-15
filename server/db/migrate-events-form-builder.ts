import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('Running events and form builder schema migration on PostgreSQL...');

  try {
    // 1. Add description, quota, is_registration_open, form_config to events
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS quota integer,
      ADD COLUMN IF NOT EXISTS is_registration_open boolean DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS form_config jsonb;
    `);
    console.log('✓ events table columns (description, quota, is_registration_open, form_config) added/verified');

    // 2. Add ticket_code, registration_data to event_attendance
    await pool.query(`
      ALTER TABLE event_attendance
      ADD COLUMN IF NOT EXISTS ticket_code text,
      ADD COLUMN IF NOT EXISTS registration_data jsonb;
    `);
    console.log('✓ event_attendance table columns (ticket_code, registration_data) added/verified');

    // 3. Create index for ticket_code
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_event_attendance_ticket ON event_attendance(ticket_code);
    `);
    console.log('✓ index idx_event_attendance_ticket created/verified');

    console.log('Events & Form Builder migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
