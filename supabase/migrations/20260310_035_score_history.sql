-- Migration 035: Score History Table
--
-- Tracks every KPI scoring recalculation for an entity.
-- Each row records the score at a point in time plus the reason it was triggered.
-- Used to display the score trend in the Analysis tab.
--
-- Design notes:
--   - Separate from analysis_snapshots (which stores the full KPI detail JSON).
--     score_history is a lightweight append-only log for trend display.
--   - trigger_reason is a human-readable string describing what caused the recalc.
--   - overall_score is on the 1–5 scale; overall_score_10 is the 1–10 display scale.
--   - kpi_count and coverage_pct are denormalized for fast trend queries.

CREATE TABLE IF NOT EXISTS score_history (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  -- Score values
  overall_score     numeric(4,2),          -- 1–5 internal scale
  overall_score_10  numeric(4,1),          -- 1–10 display scale (overall_score * 2)
  overall_score_100 integer,               -- 0–100 display scale
  coverage_pct      integer,               -- % of KPIs with data
  kpi_count         integer,               -- total KPIs scored
  missing_count     integer,               -- KPIs with missing data
  -- Context
  trigger_type      text        NOT NULL,  -- 'fact_change' | 'manual' | 'file_upload' | 'extraction' | 'deep_scan'
  trigger_reason    text,                  -- human-readable: e.g. "SDE updated to $320K"
  changed_fact_key  text,                  -- which fact key triggered this (if applicable)
  snapshot_id       uuid        REFERENCES analysis_snapshots(id) ON DELETE SET NULL,
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-entity trend queries (newest first)
CREATE INDEX IF NOT EXISTS idx_score_history_entity_created
  ON score_history(entity_id, created_at DESC);

-- RLS: users can only see score history for their own entities
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "score_history_select_own" ON score_history
  FOR SELECT USING (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "score_history_insert_own" ON score_history
  FOR INSERT WITH CHECK (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = auth.uid()
    )
  );

-- Service role bypass (for server-side inserts)
CREATE POLICY "score_history_service_all" ON score_history
  FOR ALL USING (auth.role() = 'service_role');
