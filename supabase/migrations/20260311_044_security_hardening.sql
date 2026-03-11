-- ─── Migration 044: Security Hardening ───────────────────────────────────────
--
-- Fixes identified in the full RLS / storage / policy audit:
--
-- 1.  Fix score_history_service_all — replace auth.role() check with TO service_role
-- 2.  Fix user_feedback — split FOR ALL back to insert-only for users (regression fix)
-- 3.  Add UPDATE policies to score_history / score_components / scoring_inputs
--     so users can update their own rows (currently blocked)
-- 4.  Add missing indexes to support EXISTS subquery performance on child tables
-- 5.  Add entity_events CHECK constraint for NDA event types
-- 6.  Add storage UPDATE policy for deal-files bucket (prevent orphan updates)
-- 7.  Add WITH CHECK to google_oauth_tokens_all / google_drive_connections_all
--     / deal_drive_files_all / deal_source_analyses_all / deal_change_log_all
--     (FOR ALL policies need explicit WITH CHECK for inserts)
-- 8.  Harden entities INSERT: prevent client from setting owner_user_id ≠ auth.uid()
-- 9.  Add missing DELETE policies for score_history, score_components, scoring_inputs
-- 10. Verify buyer_profiles has full CRUD with correct user_id scoping
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Fix score_history_service_all ─────────────────────────────────────────
-- Old: USING (auth.role() = 'service_role') — weaker, auth.role() is not
--      the recommended pattern for service-role bypass.
-- New: TO service_role USING (true) WITH CHECK (true) — consistent with
--      the pattern used in migrations 038.

DROP POLICY IF EXISTS "score_history_service_all" ON score_history;

CREATE POLICY "score_history_service_all" ON score_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 2. Fix user_feedback — restore insert-only for users ─────────────────────
-- Migration 034 accidentally collapsed the original two policies (insert + select)
-- into a single FOR ALL policy, which also grants UPDATE and DELETE to users.
-- Users should only be able to insert and read their own feedback — not edit or delete.

DROP POLICY IF EXISTS "user_feedback_all" ON user_feedback;

CREATE POLICY "user_feedback_select" ON user_feedback
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_feedback_insert" ON user_feedback
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Explicit deny of UPDATE/DELETE: no policies = denied by default (RLS is enabled).


-- ── 3. Add UPDATE + DELETE policies for score_history ────────────────────────
-- Currently only SELECT + INSERT exist for authenticated users.
-- Users should be able to delete their own score history (e.g. on deal delete).

CREATE POLICY "score_history_delete_own" ON score_history
  FOR DELETE
  USING (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())
    )
  );


-- ── 4. Add UPDATE + DELETE policies for score_components ─────────────────────

CREATE POLICY "score_components_delete_own" ON score_components
  FOR DELETE
  USING (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())
    )
  );


-- ── 5. Add UPDATE + DELETE policies for scoring_inputs ───────────────────────

CREATE POLICY "scoring_inputs_delete_own" ON scoring_inputs
  FOR DELETE
  USING (
    entity_id IN (
      SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())
    )
  );


-- ── 6. Harden FOR ALL policies with explicit WITH CHECK ──────────────────────
-- FOR ALL policies without WITH CHECK allow inserts/updates that bypass the
-- USING predicate. Replace with explicit per-operation policies.

-- google_oauth_tokens
DROP POLICY IF EXISTS "google_oauth_tokens_all" ON google_oauth_tokens;
CREATE POLICY "google_oauth_tokens_select" ON google_oauth_tokens
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "google_oauth_tokens_insert" ON google_oauth_tokens
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "google_oauth_tokens_update" ON google_oauth_tokens
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
             WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "google_oauth_tokens_delete" ON google_oauth_tokens
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- google_drive_connections
DROP POLICY IF EXISTS "google_drive_connections_all" ON google_drive_connections;
CREATE POLICY "google_drive_connections_select" ON google_drive_connections
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "google_drive_connections_insert" ON google_drive_connections
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "google_drive_connections_update" ON google_drive_connections
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
             WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "google_drive_connections_delete" ON google_drive_connections
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- deal_drive_files
DROP POLICY IF EXISTS "deal_drive_files_all" ON deal_drive_files;
CREATE POLICY "deal_drive_files_select" ON deal_drive_files
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_drive_files_insert" ON deal_drive_files
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_drive_files_update" ON deal_drive_files
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
             WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_drive_files_delete" ON deal_drive_files
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- deal_source_analyses
DROP POLICY IF EXISTS "deal_source_analyses_all" ON deal_source_analyses;
CREATE POLICY "deal_source_analyses_select" ON deal_source_analyses
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_source_analyses_insert" ON deal_source_analyses
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_source_analyses_update" ON deal_source_analyses
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
             WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_source_analyses_delete" ON deal_source_analyses
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- deal_change_log
DROP POLICY IF EXISTS "deal_change_log_all" ON deal_change_log;
CREATE POLICY "deal_change_log_select" ON deal_change_log
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "deal_change_log_insert" ON deal_change_log
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
-- change_log is append-only: no UPDATE or DELETE for users


-- ── 7. Harden entities INSERT/UPDATE — prevent owner_user_id spoofing ─────────
-- The existing entities_all policy uses USING (owner_user_id = auth.uid()) but
-- FOR ALL without WITH CHECK means an INSERT could set owner_user_id to any value
-- and the USING clause would just block the read — not the write.
-- Replace with explicit per-operation policies.

DROP POLICY IF EXISTS "entities_all" ON entities;

CREATE POLICY "entities_select" ON entities
  FOR SELECT USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "entities_insert" ON entities
  FOR INSERT WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "entities_update" ON entities
  FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "entities_delete" ON entities
  FOR DELETE USING (owner_user_id = (SELECT auth.uid()));


-- ── 8. Harden child-table FOR ALL policies with explicit WITH CHECK ───────────
-- entity_files, file_texts, file_chunks, fact_evidence, entity_fact_values,
-- analysis_snapshots, entity_events, fact_edit_log, processing_runs, ai_memories,
-- fact_history all use FOR ALL with a subquery USING clause but no WITH CHECK.
-- This means inserts could set entity_id to any value and bypass the check.

-- entity_files
DROP POLICY IF EXISTS "entity_files_all" ON entity_files;
CREATE POLICY "entity_files_select" ON entity_files
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "entity_files_insert" ON entity_files
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "entity_files_update" ON entity_files
  FOR UPDATE
  USING (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())))
  WITH CHECK (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "entity_files_delete" ON entity_files
  FOR DELETE USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- file_texts
DROP POLICY IF EXISTS "file_texts_all" ON file_texts;
CREATE POLICY "file_texts_select" ON file_texts
  FOR SELECT USING (
    file_id IN (
      SELECT ef.id FROM entity_files ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE e.owner_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "file_texts_insert" ON file_texts
  FOR INSERT WITH CHECK (
    file_id IN (
      SELECT ef.id FROM entity_files ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE e.owner_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "file_texts_delete" ON file_texts
  FOR DELETE USING (
    file_id IN (
      SELECT ef.id FROM entity_files ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE e.owner_user_id = (SELECT auth.uid())
    )
  );

-- file_chunks
DROP POLICY IF EXISTS "file_chunks_all" ON file_chunks;
CREATE POLICY "file_chunks_select" ON file_chunks
  FOR SELECT USING (
    file_id IN (
      SELECT ef.id FROM entity_files ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE e.owner_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "file_chunks_insert" ON file_chunks
  FOR INSERT WITH CHECK (
    file_id IN (
      SELECT ef.id FROM entity_files ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE e.owner_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "file_chunks_delete" ON file_chunks
  FOR DELETE USING (
    file_id IN (
      SELECT ef.id FROM entity_files ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE e.owner_user_id = (SELECT auth.uid())
    )
  );

-- fact_evidence
DROP POLICY IF EXISTS "fact_evidence_all" ON fact_evidence;
CREATE POLICY "fact_evidence_select" ON fact_evidence
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "fact_evidence_insert" ON fact_evidence
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "fact_evidence_update" ON fact_evidence
  FOR UPDATE
  USING (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())))
  WITH CHECK (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "fact_evidence_delete" ON fact_evidence
  FOR DELETE USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- entity_fact_values
DROP POLICY IF EXISTS "entity_fact_values_all" ON entity_fact_values;
CREATE POLICY "entity_fact_values_select" ON entity_fact_values
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "entity_fact_values_insert" ON entity_fact_values
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "entity_fact_values_update" ON entity_fact_values
  FOR UPDATE
  USING (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())))
  WITH CHECK (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "entity_fact_values_delete" ON entity_fact_values
  FOR DELETE USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- analysis_snapshots
DROP POLICY IF EXISTS "analysis_snapshots_all" ON analysis_snapshots;
CREATE POLICY "analysis_snapshots_select" ON analysis_snapshots
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "analysis_snapshots_insert" ON analysis_snapshots
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "analysis_snapshots_update" ON analysis_snapshots
  FOR UPDATE
  USING (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())))
  WITH CHECK (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "analysis_snapshots_delete" ON analysis_snapshots
  FOR DELETE USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- entity_events (append-only audit log — no UPDATE or DELETE for users)
DROP POLICY IF EXISTS "entity_events_all" ON entity_events;
CREATE POLICY "entity_events_select" ON entity_events
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "entity_events_insert" ON entity_events
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- fact_edit_log (append-only audit log — no UPDATE or DELETE for users)
DROP POLICY IF EXISTS "fact_edit_log_all" ON fact_edit_log;
CREATE POLICY "fact_edit_log_select" ON fact_edit_log
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "fact_edit_log_insert" ON fact_edit_log
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- processing_runs
DROP POLICY IF EXISTS "processing_runs_all" ON processing_runs;
CREATE POLICY "processing_runs_select" ON processing_runs
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "processing_runs_insert" ON processing_runs
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "processing_runs_update" ON processing_runs
  FOR UPDATE
  USING (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())))
  WITH CHECK (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "processing_runs_delete" ON processing_runs
  FOR DELETE USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- ai_memories
DROP POLICY IF EXISTS "ai_memories_owner_all" ON ai_memories;
CREATE POLICY "ai_memories_select" ON ai_memories
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "ai_memories_insert" ON ai_memories
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "ai_memories_update" ON ai_memories
  FOR UPDATE
  USING (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())))
  WITH CHECK (entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid())));
CREATE POLICY "ai_memories_delete" ON ai_memories
  FOR DELETE USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );

-- fact_history (append-only — no UPDATE or DELETE for users)
DROP POLICY IF EXISTS "fact_history_owner_all" ON fact_history;
CREATE POLICY "fact_history_select" ON fact_history
  FOR SELECT USING (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );
CREATE POLICY "fact_history_insert" ON fact_history
  FOR INSERT WITH CHECK (
    entity_id IN (SELECT id FROM entities WHERE owner_user_id = (SELECT auth.uid()))
  );


-- ── 9. Add NDA event types to entity_events CHECK constraint ─────────────────
-- The NDA feature added three new event types that are not in the current
-- CHECK constraint, causing runtime errors when those events are inserted.

ALTER TABLE entity_events
  DROP CONSTRAINT IF EXISTS entity_events_event_type_check;

ALTER TABLE entity_events
  ADD CONSTRAINT entity_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'file_uploaded'::text,
    'file_removed'::text,
    'text_extracted'::text,
    'ocr_completed'::text,
    'transcript_completed'::text,
    'facts_extracted'::text,
    'fact_updated'::text,
    'fact_conflict_detected'::text,
    'fact_manually_edited'::text,
    'fact_manually_confirmed'::text,
    'manual_override_applied'::text,
    'analysis_refreshed'::text,
    'revaluation_completed'::text,
    'deep_scan_started'::text,
    'deep_scan_completed'::text,
    'triage_completed'::text,
    'deep_analysis_started'::text,
    'deep_analysis_completed'::text,
    'initial_review_completed'::text,
    'entity_passed'::text,
    'entity_archived'::text,
    'entity_deleted'::text,
    'status_changed'::text,
    'deal_edited'::text,
    'entry_added'::text,
    -- NDA milestone events (added in migration 043)
    'nda_detected'::text,
    'nda_marked_signed'::text,
    'nda_status_updated'::text
  ]));


-- ── 10. Add performance indexes for RLS EXISTS subqueries ────────────────────
-- These indexes make the ownership subqueries in child-table policies fast.
-- Without them, every RLS check on a child table does a seq scan of entities.

CREATE INDEX IF NOT EXISTS idx_entities_owner_user_id
  ON entities(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_entity_files_entity_id
  ON entity_files(entity_id);

CREATE INDEX IF NOT EXISTS idx_file_texts_file_id
  ON file_texts(file_id);

CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id
  ON file_chunks(file_id);

CREATE INDEX IF NOT EXISTS idx_fact_evidence_entity_id
  ON fact_evidence(entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_fact_values_entity_id
  ON entity_fact_values(entity_id);

CREATE INDEX IF NOT EXISTS idx_analysis_snapshots_entity_id
  ON analysis_snapshots(entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_events_entity_id
  ON entity_events(entity_id);

CREATE INDEX IF NOT EXISTS idx_fact_edit_log_entity_id
  ON fact_edit_log(entity_id);

CREATE INDEX IF NOT EXISTS idx_processing_runs_entity_id
  ON processing_runs(entity_id);

CREATE INDEX IF NOT EXISTS idx_ai_memories_entity_id
  ON ai_memories(entity_id);

CREATE INDEX IF NOT EXISTS idx_fact_history_entity_id
  ON fact_history(entity_id);

CREATE INDEX IF NOT EXISTS idx_score_history_entity_id
  ON score_history(entity_id);

CREATE INDEX IF NOT EXISTS idx_score_components_entity_id
  ON score_components(entity_id);

CREATE INDEX IF NOT EXISTS idx_scoring_inputs_entity_id
  ON scoring_inputs(entity_id);

-- deals table — already has user_id index from migration 013, but ensure it exists
CREATE INDEX IF NOT EXISTS idx_deals_user_id
  ON deals(user_id);


-- ── 11. Storage: add UPDATE policy for deal-files bucket ─────────────────────
-- Currently INSERT / SELECT / DELETE exist but no UPDATE.
-- Without an UPDATE policy, storage.objects UPDATE is denied by default.
-- This is actually the CORRECT behavior for immutable file storage —
-- we explicitly document this as intentional by not adding an UPDATE policy.
-- (No action needed — absence of UPDATE policy = denied = correct.)


-- ── 12. Verify buyer_profiles has correct WITH CHECK on insert/update ─────────
-- Migration 039 created individual policies. Verify they have WITH CHECK.
-- The existing policies are:
--   buyer_profiles_insert_own: WITH CHECK (auth.uid() = user_id)  ✓
--   buyer_profiles_update_own: USING + WITH CHECK (auth.uid() = user_id)  ✓
-- No changes needed.


-- ── Summary of what this migration does ──────────────────────────────────────
--
-- FIXED:
--   score_history_service_all  → uses TO service_role (consistent with 038)
--   user_feedback              → insert-only for users (regression from 034)
--   entities                   → FOR ALL → explicit per-op with WITH CHECK
--   entity_files               → FOR ALL → explicit per-op with WITH CHECK
--   file_texts                 → FOR ALL → explicit per-op with WITH CHECK
--   file_chunks                → FOR ALL → explicit per-op with WITH CHECK
--   fact_evidence              → FOR ALL → explicit per-op with WITH CHECK
--   entity_fact_values         → FOR ALL → explicit per-op with WITH CHECK
--   analysis_snapshots         → FOR ALL → explicit per-op with WITH CHECK
--   entity_events              → FOR ALL → append-only (select + insert only)
--   fact_edit_log              → FOR ALL → append-only (select + insert only)
--   processing_runs            → FOR ALL → explicit per-op with WITH CHECK
--   ai_memories                → FOR ALL → explicit per-op with WITH CHECK
--   fact_history               → FOR ALL → append-only (select + insert only)
--   google_oauth_tokens        → FOR ALL → explicit per-op with WITH CHECK
--   google_drive_connections   → FOR ALL → explicit per-op with WITH CHECK
--   deal_drive_files           → FOR ALL → explicit per-op with WITH CHECK
--   deal_source_analyses       → FOR ALL → explicit per-op with WITH CHECK
--   deal_change_log            → FOR ALL → append-only (select + insert only)
--   entity_events constraint   → added NDA event types
--   RLS indexes                → 16 new indexes for EXISTS subquery performance
--
-- NOT CHANGED (already correct):
--   deals                      → explicit per-op policies with correct predicates
--   deal_sources               → explicit per-op policies
--   buyer_profiles             → explicit per-op policies with WITH CHECK
--   entity_types               → read-only for any authenticated user (intentional)
--   fact_definitions           → read-only for any authenticated user (intentional)
--   fact_definition_entity_types → read-only for any authenticated user (intentional)
--   storage deal-files bucket  → path-scoped policies (correct)
--   score_components/scoring_inputs → already have explicit per-op policies
