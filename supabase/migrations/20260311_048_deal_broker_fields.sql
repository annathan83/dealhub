-- ─── Migration 048: Deal broker fields ─────────────────────────────────────────
--
-- Adds optional denormalized broker contact fields to the deals table for:
-- - Search indexing (broker name, phone, email)
-- - Deal creation and edit forms
-- - Display when deal_contacts is not yet populated
--
-- deal_contacts remains the source of truth for multi-contact and extraction.
-- These columns can be synced from the primary contact for simple list/search.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS broker_name  text,
  ADD COLUMN IF NOT EXISTS broker_email text,
  ADD COLUMN IF NOT EXISTS broker_phone text;

-- Indexes for search (client and future server-side)
CREATE INDEX IF NOT EXISTS idx_deals_broker_name
  ON deals(user_id)
  WHERE broker_name IS NOT NULL AND trim(broker_name) != '';

CREATE INDEX IF NOT EXISTS idx_deals_broker_phone
  ON deals(user_id)
  WHERE broker_phone IS NOT NULL AND trim(broker_phone) != '';

COMMENT ON COLUMN deals.broker_name  IS 'Denormalized primary broker/contact name for search and display.';
COMMENT ON COLUMN deals.broker_email IS 'Denormalized primary broker/contact email for search and display.';
COMMENT ON COLUMN deals.broker_phone IS 'Denormalized primary broker/contact phone for search and display.';
