CREATE TABLE IF NOT EXISTS "email_broadcast_daily_usage" (
	"usage_date" date PRIMARY KEY NOT NULL,
	"dispatch_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
