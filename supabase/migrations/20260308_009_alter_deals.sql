-- Migration 009: alter deals table + backfill bridge
-- Adds current-state pointers to the deals table.
-- Backfills deal_files from existing deal_drive_files rows.
-- Run AFTER migrations 003-008.
-- Run in Supabase dashboard → SQL Editor.

-- ── 1. Add current-state pointer columns to deals ──────────────────────────

alter table deals
  add column if not exists last_analysis_run_id  uuid references deal_analysis_runs(id) on delete set null,
  add column if not exists current_opinion_id    uuid references deal_opinions(id) on delete set null;

create index if not exists deals_last_run_idx
  on deals(last_analysis_run_id)
  where last_analysis_run_id is not null;

create index if not exists deals_current_opinion_idx
  on deals(current_opinion_id)
  where current_opinion_id is not null;

-- ── 2. Backfill deal_files from deal_drive_files ────────────────────────────
-- This is a one-time migration. It is safe to re-run (ON CONFLICT DO NOTHING
-- guard is provided via the legacy_drive_file_id uniqueness check).

insert into deal_files (
  id,
  deal_id,
  user_id,
  storage_provider,
  provider_file_id,
  provider_file_name,
  web_view_link,
  original_file_name,
  mime_type,
  source_kind,
  uploaded_by,
  uploaded_at,
  ingest_status,
  legacy_drive_file_id,
  created_at
)
select
  gen_random_uuid()                          as id,
  ddf.deal_id,
  ddf.user_id,
  'google_drive'                             as storage_provider,
  ddf.google_file_id                         as provider_file_id,
  ddf.google_file_name                       as provider_file_name,
  ddf.web_view_link,
  coalesce(ddf.original_file_name, ddf.google_file_name) as original_file_name,
  ddf.mime_type,
  'uploaded_file'                            as source_kind,
  ddf.user_id                                as uploaded_by,
  coalesce(ddf.created_at, now())            as uploaded_at,
  'processed'                                as ingest_status,
  ddf.id                                     as legacy_drive_file_id,
  coalesce(ddf.created_at, now())            as created_at
from deal_drive_files ddf
where not exists (
  select 1
  from deal_files df
  where df.legacy_drive_file_id = ddf.id
);

-- ── 3. Backfill deal_file_derivatives.deal_file_id ─────────────────────────
-- Link existing derivative rows to the newly created deal_files rows
-- by matching on the Google Drive file ID stored in deal_file_derivatives.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'deal_file_derivatives'
      and column_name = 'deal_file_id'
  ) then
    update deal_file_derivatives dfd
    set deal_file_id = df.id
    from deal_files df
    where df.provider_file_id = dfd.google_file_id  -- correct column name (was google_drive_file_id — bug fixed in 013)
      and dfd.deal_file_id is null;
  end if;
end $$;
