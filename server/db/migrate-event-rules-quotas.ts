import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('Running event rules, segmented quotas & parking migration on PostgreSQL...');

  try {
    // 1. Add target_audience, quota_ikhwan, quota_akhwat, car_parking_quota, motorcycle_parking_quota, venue_rules, custom_venue_rules to events
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS target_audience text DEFAULT 'umum' NOT NULL,
      ADD COLUMN IF NOT EXISTS quota_ikhwan integer,
      ADD COLUMN IF NOT EXISTS quota_akhwat integer,
      ADD COLUMN IF NOT EXISTS car_parking_quota integer,
      ADD COLUMN IF NOT EXISTS motorcycle_parking_quota integer,
      ADD COLUMN IF NOT EXISTS venue_rules jsonb,
      ADD COLUMN IF NOT EXISTS custom_venue_rules text;
    `);
    console.log('✓ events table columns (target_audience, quota_ikhwan, quota_akhwat, car_parking_quota, motorcycle_parking_quota, venue_rules, custom_venue_rules) added/verified');

    // 2. Add vehicle_type, vehicle_plate_number, agreed_to_rules to event_attendance
    await pool.query(`
      ALTER TABLE event_attendance
      ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'none' NOT NULL,
      ADD COLUMN IF NOT EXISTS vehicle_plate_number text,
      ADD COLUMN IF NOT EXISTS agreed_to_rules boolean DEFAULT true NOT NULL;
    `);
    console.log('✓ event_attendance table columns (vehicle_type, vehicle_plate_number, agreed_to_rules) added/verified');

    // 3. Create index for target_audience
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_target_audience ON events(target_audience);
    `);
    console.log('✓ index idx_events_target_audience created/verified');

    console.log('Event rules, segmented quotas & parking migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
