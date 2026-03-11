-- ─── Migration 047: Intake Lifecycle ─────────────────────────────────────────
--
-- Adds a separate intake_status column to deals so that deals rejected during
-- initial assessment are excluded from the deal list and statistics without
-- changing the existing 3-value lifecycle status (active / closed / passed).
--
-- Design:
--   intake_status = NULL        → legacy deal (created before this migration),
--                                 treated as 'promoted' for all queries
--   intake_status = 'pending'   → deal was just created, scoring in progress
--   intake_status = 'rejected'  → PROBABLY_PASS verdict at intake; excluded from
--                                 deal list and stats; Drive folder queued for cleanup
--   intake_status = 'promoted'  → passed intake (or user chose "Keep anyway");
--                                 fully visible normal deal
--
-- All existing deals get intake_status = 'promoted' so nothing breaks.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add intake_status column ───────────────────────────────────────────────

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS intake_status text
    CHECK (intake_status IN ('pending', 'rejected', 'promoted'));

-- Backfill: all existing deals are already promoted
UPDATE deals
  SET intake_status = 'promoted'
  WHERE intake_status IS NULL;

-- Add index for fast filtering in deal list and dashboard queries
CREATE INDEX IF NOT EXISTS idx_deals_intake_status
  ON deals(user_id, intake_status);

COMMENT ON COLUMN deals.intake_status IS
  'Intake lifecycle gate. NULL/promoted = visible normal deal. rejected = screened out at intake, hidden from list and stats. pending = scoring in progress.';


-- ── 2. intake_rejections audit table ─────────────────────────────────────────
-- Lightweight append-only log of deals rejected at intake.
-- Not shown in the deal list. For internal traceability only.

CREATE TABLE IF NOT EXISTS intake_rejections (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             uuid        REFERENCES deals(id) ON DELETE SET NULL,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source context
  source_type         text,       -- 'paste', 'manual', 'file_upload'
  source_name         text,       -- deal name at time of rejection

  -- Timestamps
  intake_created_at   timestamptz,
  rejected_at         timestamptz NOT NULL DEFAULT now(),

  -- Rejection reason
  rejection_reason    text,       -- e.g. 'PROBABLY_PASS'
  rejection_flags     text[],     -- specific flags from the triage recommendation

  -- Extracted facts at time of rejection (for audit/debugging)
  extracted_industry  text,
  extracted_location  text,
  extracted_price     text,
  extracted_sde       text,

  -- Short AI summary if available
  ai_summary_short    text,

  -- Score at time of rejection
  score_at_rejection  numeric(5,2),

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_rejections_user_id
  ON intake_rejections(user_id, rejected_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_rejections_deal_id
  ON intake_rejections(deal_id);

-- RLS
ALTER TABLE intake_rejections ENABLE ROW LEVEL SECURITY;

-- Users can only read their own rejection log (read-only for users)
CREATE POLICY "intake_rejections_select" ON intake_rejections
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Insert allowed (server-side inserts via service role bypass RLS)
CREATE POLICY "intake_rejections_insert" ON intake_rejections
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE intake_rejections IS
  'Append-only audit log of deals screened out during initial intake assessment. Not shown in deal list or statistics.';
