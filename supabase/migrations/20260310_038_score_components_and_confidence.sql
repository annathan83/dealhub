-- Migration: score_components table + confidence fields on score_history
--
-- Supports:
-- 1. Component-level KPI score storage per scoring run
-- 2. Scoring confidence (0-100) based on source provenance of facts used
-- 3. Scoring input provenance (which facts were used, from what source)

-- ── 1. score_components ────────────────────────────────────────────────────────
-- Stores individual KPI component scores for each scoring run.
-- One row per KPI per scoring run.

CREATE TABLE IF NOT EXISTS score_components (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             uuid        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  score_history_id      uuid        REFERENCES score_history(id) ON DELETE CASCADE,
  snapshot_id           uuid        REFERENCES analysis_snapshots(id) ON DELETE SET NULL,

  -- Component identity
  component_key         text        NOT NULL,  -- e.g. "price_multiple", "sde_or_ebitda"
  component_label       text        NOT NULL,  -- e.g. "Price Multiple"

  -- Scoring values (all 0-10 scale)
  raw_value             text,                  -- human-readable raw value, e.g. "3.2x"
  normalized_score      numeric(4,2),          -- 0-10 score for this component
  weight                numeric(5,4),          -- e.g. 0.12
  weighted_score        numeric(5,4),          -- normalized_score * weight
  rationale             text,                  -- explanation of why this score was given
  kpi_status            text        NOT NULL DEFAULT 'known'
                          CHECK (kpi_status IN ('known', 'estimated', 'missing')),

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_components_entity
  ON score_components(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_components_history
  ON score_components(score_history_id);

-- RLS
ALTER TABLE score_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY score_components_select_own ON score_components
  FOR SELECT USING (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY score_components_insert_own ON score_components
  FOR INSERT WITH CHECK (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY score_components_service_all ON score_components
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── 2. Add confidence + provenance fields to score_history ────────────────────

ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS confidence_score      integer,  -- 0-100
  ADD COLUMN IF NOT EXISTS total_facts_used      integer,  -- how many facts fed into scoring
  ADD COLUMN IF NOT EXISTS document_backed_count integer,  -- ai_extracted with snippet
  ADD COLUMN IF NOT EXISTS manual_count          integer,  -- user_override without doc evidence
  ADD COLUMN IF NOT EXISTS inferred_count        integer,  -- ai_inferred
  ADD COLUMN IF NOT EXISTS override_count        integer;  -- user_override (all overrides)


-- ── 3. scoring_inputs — provenance of each fact used in a scoring run ─────────

CREATE TABLE IF NOT EXISTS scoring_inputs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             uuid        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  score_history_id      uuid        REFERENCES score_history(id) ON DELETE CASCADE,

  -- Which fact was used
  fact_key              text        NOT NULL,  -- e.g. "sde_latest"
  fact_definition_id    uuid        REFERENCES fact_definitions(id) ON DELETE SET NULL,

  -- What value was used
  value_used            text,
  value_source_type     text        NOT NULL
                          CHECK (value_source_type IN (
                            'ai_extracted', 'ai_inferred', 'user_override',
                            'broker_confirmed', 'imported', 'system_derived'
                          )),

  -- Source quality weight used for confidence calculation
  -- 1.0 = document-backed, 0.8 = user override, 0.0 = manual/inferred
  source_quality_weight numeric(3,2) NOT NULL DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_inputs_history
  ON scoring_inputs(score_history_id);

CREATE INDEX IF NOT EXISTS idx_scoring_inputs_entity
  ON scoring_inputs(entity_id, created_at DESC);

-- RLS
ALTER TABLE scoring_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scoring_inputs_select_own ON scoring_inputs
  FOR SELECT USING (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY scoring_inputs_insert_own ON scoring_inputs
  FOR INSERT WITH CHECK (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY scoring_inputs_service_all ON scoring_inputs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
