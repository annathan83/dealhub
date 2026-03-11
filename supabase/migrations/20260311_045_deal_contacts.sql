-- ─── Migration 045: Deal Contacts ────────────────────────────────────────────
--
-- Adds a structured deal_contacts table to replace the flat broker_name /
-- broker_contact fact values for contact storage.
--
-- Design decisions:
--   - deal_contacts is the authoritative store for contact info.
--   - The legacy broker_name / broker_contact fact definitions remain in
--     fact_definitions so existing entity_fact_values rows are not broken.
--     They are now treated as read-only extraction staging — the contact
--     service syncs them into deal_contacts on every ingestion run.
--   - Multiple contacts per deal are supported (broker, seller, assistant, other).
--   - is_primary = true marks the contact shown in the deal list and header.
--   - source_type distinguishes AI-extracted from user-entered values.
--   - Manual edits set source_type = 'user_entered' and are never overwritten
--     by AI extraction.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. deal_contacts table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deal_contacts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name            text,
  role            text        NOT NULL DEFAULT 'broker'
                              CHECK (role IN ('broker','assistant','seller','other')),
  phone           text,
  email           text,
  brokerage       text,

  -- Source / provenance
  source_type     text        NOT NULL DEFAULT 'ai_extracted'
                              CHECK (source_type IN ('ai_extracted','user_entered','imported')),
  source_label    text,                 -- e.g. "listing.txt", "broker email", "user"
  source_file_id  uuid        REFERENCES entity_files(id) ON DELETE SET NULL,
  confidence      numeric(4,3),         -- 0.000–1.000 (null = user entered)

  -- Display / ordering
  is_primary      boolean     NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id
  ON deal_contacts(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_user_id
  ON deal_contacts(user_id);

-- Partial index: fast lookup of primary contact per deal
CREATE INDEX IF NOT EXISTS idx_deal_contacts_primary
  ON deal_contacts(deal_id, is_primary)
  WHERE is_primary = true;

-- Phone digit index for normalized search (digits only, e.g. "3055551234")
-- Stored as a generated column so we can index it efficiently.
ALTER TABLE deal_contacts
  ADD COLUMN IF NOT EXISTS phone_digits text
    GENERATED ALWAYS AS (regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_deal_contacts_phone_digits
  ON deal_contacts(phone_digits)
  WHERE phone_digits IS NOT NULL AND phone_digits != '';

-- ── 3. updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_deal_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_contacts_updated_at ON deal_contacts;
CREATE TRIGGER trg_deal_contacts_updated_at
  BEFORE UPDATE ON deal_contacts
  FOR EACH ROW EXECUTE FUNCTION set_deal_contacts_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_contacts_select" ON deal_contacts
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "deal_contacts_insert" ON deal_contacts
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "deal_contacts_update" ON deal_contacts
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "deal_contacts_delete" ON deal_contacts
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ── 5. Add broker_phone and broker_email as separate fact definitions ──────────
-- These supplement (not replace) broker_contact so the extraction prompt can
-- ask for phone and email as distinct fields.

INSERT INTO fact_definitions (key, label, description, category, data_type, is_critical, is_multi_value)
VALUES
  ('broker_phone',     'Broker Phone',     'Broker or agent direct phone number',  'people', 'text', false, false),
  ('broker_email',     'Broker Email',     'Broker or agent email address',         'people', 'text', false, false),
  ('broker_brokerage', 'Brokerage',        'Name of the brokerage firm',            'people', 'text', false, false)
ON CONFLICT (key) DO NOTHING;

-- Link new facts to the 'deal' entity type
INSERT INTO fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
SELECT
  fd.id,
  et.id,
  false,
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM fact_definition_entity_types WHERE entity_type_id = et.id)
FROM fact_definitions fd
CROSS JOIN entity_types et
WHERE et.key = 'deal'
  AND fd.key IN ('broker_phone', 'broker_email', 'broker_brokerage')
ON CONFLICT (fact_definition_id, entity_type_id) DO NOTHING;

-- ── 6. Comments ───────────────────────────────────────────────────────────────

COMMENT ON TABLE deal_contacts IS
  'Structured broker and seller contact records per deal. Populated by AI extraction and user edits.';

COMMENT ON COLUMN deal_contacts.source_type IS
  'ai_extracted = populated by ingestion pipeline; user_entered = manually added/edited; imported = bulk import';

COMMENT ON COLUMN deal_contacts.is_primary IS
  'True for the contact shown in the deal list and deal header. At most one primary per deal.';

COMMENT ON COLUMN deal_contacts.phone_digits IS
  'Generated column: phone stripped to digits only, used for normalized phone search.';
