ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS automatic_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS send_hour_wib integer NOT NULL DEFAULT 8;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS start_date_wib date;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS dispatch_lock_until timestamptz;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS last_run_error text;

CREATE TABLE IF NOT EXISTS drip_email_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  usage_date date NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  provider_message_id text,
  error text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_drip_attempts_campaign_date ON drip_email_attempts(campaign_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_schedule ON email_campaigns(automatic_enabled, status, start_date_wib);
