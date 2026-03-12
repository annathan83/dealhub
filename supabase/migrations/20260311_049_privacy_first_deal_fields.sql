-- Migration 049: Privacy-first deal fields
--
-- Goal: Align deal record with privacy-first architecture. Do not store real business
-- names or confidential raw content in the app database; raw files stay in Google Drive.
--
-- Adds:
--   display_alias  — Masked/user-facing name (e.g. "Deal #42", "Tampa HVAC"). Use for all UI.
--   last_activity_at — When the deal was last active (for sorting/filters). Defaults to updated_at.
--
-- Deprecated (retained for backward compatibility; do not rely on for new features):
--   name — Prefer display_alias for display. name remains NOT NULL for now; can store alias or fallback.
--   description — Do not store confidential or raw document content here. Optional; consider not persisting.
--   city — Use only when not confidential; prefer county/metro for location_general.
--   location — Legacy free text; prefer state/county/city for structured location_general.
--

-- Add new columns
alter table deals
  add column if not exists display_alias text,
  add column if not exists last_activity_at timestamptz;

-- Backfill last_activity_at from updated_at where null
update deals
set last_activity_at = coalesce(updated_at, created_at)
where last_activity_at is null;

-- Default for new/updated rows: keep last_activity_at in sync with updated_at when not explicitly set
comment on column deals.display_alias is 'Privacy-safe display name (alias). Use for all UI. Do not store real business name.';
comment on column deals.last_activity_at is 'Last activity timestamp for sorting/filters.';
comment on column deals.name is 'DEPRECATED for display: use display_alias. Retained NOT NULL for backward compatibility.';
comment on column deals.description is 'DEPRECATED: do not store confidential or raw document content. Raw content belongs in Drive only.';
comment on column deals.city is 'Optional; use only when not confidential. Prefer county/state for location_general.';

-- Index for activity-based ordering
create index if not exists deals_last_activity_at_idx
  on deals (user_id, last_activity_at desc nulls last)
  where intake_status is null or intake_status = 'promoted';
