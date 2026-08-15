import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('Running donor pipeline schema migration on Neon PostgreSQL...');

  try {
    // 1. Create Enum
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donor_pipeline_stage_enum') THEN
          CREATE TYPE donor_pipeline_stage_enum AS ENUM (
            'new_lead',
            'contacted',
            'interested',
            'donated_once',
            'regular_donor',
            'loyal',
            'dormant'
          );
        END IF;
      END $$;
    `);
    console.log('✓ donor_pipeline_stage_enum created/verified');

    // 2. Add donor_stage column to persons
    await pool.query(`
      ALTER TABLE persons
      ADD COLUMN IF NOT EXISTS donor_stage donor_pipeline_stage_enum DEFAULT 'new_lead' NOT NULL;
    `);
    console.log('✓ persons.donor_stage column added/verified');

    // 3. Create donor_stage_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS donor_stage_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
        from_stage donor_pipeline_stage_enum,
        to_stage donor_pipeline_stage_enum NOT NULL,
        reason text,
        changed_by uuid NOT NULL REFERENCES app_users(id),
        changed_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ donor_stage_history table created/verified');

    // 4. Create Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_persons_donor_stage ON persons(donor_stage);
      CREATE INDEX IF NOT EXISTS idx_donor_stage_hist_person ON donor_stage_history(person_id);
    `);
    console.log('✓ indexes created/verified');

    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
