import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('🚀 Running email_campaigns schema migration on Neon PostgreSQL...');

  try {
    // 1. Create email_campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        subject text NOT NULL,
        body_html text NOT NULL,
        daily_quota integer DEFAULT 50 NOT NULL,
        total_days integer DEFAULT 14 NOT NULL,
        current_day integer DEFAULT 1 NOT NULL,
        status text DEFAULT 'running' NOT NULL,
        filter_gender text DEFAULT 'all' NOT NULL,
        stats jsonb NOT NULL,
        recipients jsonb NOT NULL,
        last_dispatched_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        created_by uuid REFERENCES app_users(id)
      );
    `);
    console.log('✓ email_campaigns table created/verified');

    // 2. Create Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at);
    `);
    console.log('✓ indexes created/verified');

    console.log('✅ email_campaigns migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
