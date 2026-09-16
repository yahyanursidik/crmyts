CREATE TABLE IF NOT EXISTS event_email_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS event_email_broadcast_campaigns (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id uuid REFERENCES event_email_templates(id) ON DELETE SET NULL,
  content_key text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  batch_size integer NOT NULL DEFAULT 100,
  target_count integer NOT NULL DEFAULT 0,
  duplicate_skipped_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  last_dispatched_at timestamptz,
  completed_at timestamptz
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS event_email_broadcast_recipients (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES event_email_broadcast_campaigns(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES event_attendance(id) ON DELETE CASCADE,
  email text NOT NULL,
  recipient_name text NOT NULL,
  ticket_code text,
  message_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  UNIQUE(campaign_id, email)
);
