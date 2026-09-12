import { getDbPool } from './client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const pool = getDbPool();
  console.log('🚀 Running email_blacklist schema migration on Neon PostgreSQL...');

  try {
    // 1. Create email_blacklist table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_blacklist (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        reason text DEFAULT 'already_sent' NOT NULL,
        notes text,
        source_campaign_id uuid,
        person_id uuid,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        created_by uuid REFERENCES app_users(id)
      );
    `);
    console.log('✓ email_blacklist table created/verified');

    // 2. Create Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_blacklist_email ON email_blacklist(email);
      CREATE INDEX IF NOT EXISTS idx_email_blacklist_reason ON email_blacklist(reason);
      CREATE INDEX IF NOT EXISTS idx_email_blacklist_created_at ON email_blacklist(created_at);
    `);
    console.log('✓ indexes created/verified');

    console.log('✅ email_blacklist migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
