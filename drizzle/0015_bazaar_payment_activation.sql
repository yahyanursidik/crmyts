-- Existing bank data is preserved. Transfer instructions require explicit staff activation.
ALTER TABLE bazaar_events ADD COLUMN IF NOT EXISTS payment_enabled boolean NOT NULL DEFAULT false;
