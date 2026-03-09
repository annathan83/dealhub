-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027: Remove deprecated columns
--
-- Removes:
--   entities.deep_scan_status / deep_scan_started_at / deep_scan_completed_at /
--           deep_scan_facts_added / deep_scan_facts_updated / deep_scan_conflicts_found
--   entity_fact_values.manual_override / override_note / override_by / override_at
--
-- Pre-conditions (verified before this migration):
--   • All callers of deep_scan_* columns have been migrated to processing_runs.
--   • All callers of manual_override/* columns use value_source_type / review_status.
--   • Migration 026 already backfilled value_source_type and review_status from
--     manual_override rows, so no data is lost.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. entities — drop deep_scan_* operational columns ───────────────────────
-- These are fully superseded by processing_runs where run_type IN ('deep_scan','deep_analysis').
-- The three denormalized summary fields (deep_analysis_run_at, deep_analysis_stale,
-- latest_source_at) are intentionally KEPT for fast UI reads.

alter table entities
  drop column if exists deep_scan_status,
  drop column if exists deep_scan_started_at,
  drop column if exists deep_scan_completed_at,
  drop column if exists deep_scan_facts_added,
  drop column if exists deep_scan_facts_updated,
  drop column if exists deep_scan_conflicts_found;

-- ── 2. entity_fact_values — drop legacy manual_override columns ───────────────
-- Superseded by value_source_type = 'user_override' and review_status = 'confirmed'/'edited'.
-- Migration 026 already backfilled these new columns from the old override fields.

alter table entity_fact_values
  drop column if exists manual_override,
  drop column if exists override_note,
  drop column if exists override_by,
  drop column if exists override_at;
