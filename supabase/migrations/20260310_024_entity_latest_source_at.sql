-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024: Add latest_source_at to entities
--
-- Tracks when the most recent source text was added to an entity.
-- Used to show "New information added X ago" in the Deep Analysis stale banner,
-- giving users a precise sense of how outdated the analysis is.
-- ─────────────────────────────────────────────────────────────────────────────

alter table entities
  add column if not exists latest_source_at timestamptz;
