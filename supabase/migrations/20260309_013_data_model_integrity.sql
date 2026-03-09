-- ============================================================================
-- Migration 013: Data model integrity fixes
--
-- Addresses findings from data architecture audit:
--   C2  - Add deal_file_id FK column to deal_file_derivatives
--   H1  - Fix deal_files.uploaded_by missing ON DELETE clause
--   H2  - Add updated_at + trigger to deal_files and deal_analysis_runs
--   H3  - Add updated_at to deal_source_claims (mutated by supersedePreviousClaims)
--   H4  - Add unique constraint on deal_files(deal_id, provider_file_id)
--   H5  - Add CHECK constraints on all documented enum text columns
--   M1  - Add NOT NULL to deal_change_log.description (fix TypeScript mismatch)
--   M2  - Add missing composite indexes
--   M3  - Fix unnamed user_feedback indexes
--   C1  - Commit DDL for core tables as documentation (idempotent CREATE IF NOT EXISTS)
-- ============================================================================

-- ── C2: Add deal_file_id FK to deal_file_derivatives ─────────────────────────
-- This column was referenced in code but never created, breaking the link
-- between deal_file_derivatives and deal_files.
alter table deal_file_derivatives
  add column if not exists deal_file_id uuid
    references deal_files(id) on delete set null;

create index if not exists deal_file_derivatives_deal_file_id_idx
  on deal_file_derivatives(deal_file_id)
  where deal_file_id is not null;

-- Backfill: link existing derivatives to deal_files via google_file_id
-- (safe to run multiple times — only updates rows where link is missing)
update deal_file_derivatives dfd
set deal_file_id = df.id
from deal_files df
where dfd.deal_file_id is null
  and dfd.google_file_id is not null
  and df.provider_file_id = dfd.google_file_id
  and dfd.deal_id = df.deal_id;

-- ── H1: Fix deal_files.uploaded_by ON DELETE ─────────────────────────────────
-- The existing FK defaults to RESTRICT, which blocks user deletion.
-- Drop and re-add with SET NULL.
alter table deal_files
  drop constraint if exists deal_files_uploaded_by_fkey;

alter table deal_files
  add constraint deal_files_uploaded_by_fkey
    foreign key (uploaded_by)
    references auth.users(id)
    on delete set null;

-- ── H2: Add updated_at to deal_files and deal_analysis_runs ──────────────────
alter table deal_files
  add column if not exists updated_at timestamptz not null default now();

alter table deal_analysis_runs
  add column if not exists updated_at timestamptz not null default now();

-- Wire the existing set_updated_at() trigger function to both tables
drop trigger if exists deal_files_updated_at on deal_files;
create trigger deal_files_updated_at
  before update on deal_files
  for each row execute procedure set_updated_at();

drop trigger if exists deal_analysis_runs_updated_at on deal_analysis_runs;
create trigger deal_analysis_runs_updated_at
  before update on deal_analysis_runs
  for each row execute procedure set_updated_at();

-- ── H3: Add updated_at to deal_source_claims ─────────────────────────────────
-- supersedePreviousClaims() mutates rows (sets is_active, superseded_by)
-- but there was no way to know when a claim was last changed.
alter table deal_source_claims
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists deal_source_claims_updated_at on deal_source_claims;
create trigger deal_source_claims_updated_at
  before update on deal_source_claims
  for each row execute procedure set_updated_at();

-- ── H4: Unique constraint for file deduplication ─────────────────────────────
-- getDealFileByProviderId is used for dedup but had no DB-level enforcement.
-- A race condition could create duplicate rows — this prevents it.
create unique index if not exists deal_files_deal_provider_unique_idx
  on deal_files(deal_id, provider_file_id)
  where provider_file_id is not null;

-- ── H5: CHECK constraints on enum text columns ───────────────────────────────

-- deal_file_derivatives
alter table deal_file_derivatives
  drop constraint if exists deal_file_derivatives_extraction_status_check,
  add constraint deal_file_derivatives_extraction_status_check
    check (extraction_status in ('pending','processing','done','failed'));

alter table deal_file_derivatives
  drop constraint if exists deal_file_derivatives_file_type_check,
  add constraint deal_file_derivatives_file_type_check
    check (file_type in ('pdf','image','audio','text','spreadsheet','unknown'));

alter table deal_file_derivatives
  drop constraint if exists deal_file_derivatives_confidence_check,
  add constraint deal_file_derivatives_confidence_check
    check (confidence is null or confidence in ('high','medium','low'));

-- deal_files
alter table deal_files
  drop constraint if exists deal_files_storage_provider_check,
  add constraint deal_files_storage_provider_check
    check (storage_provider in ('google_drive','s3','local','supabase_storage'));

-- ingest_status: 'queued' and 'processed' are used in TypeScript + live data
alter table deal_files
  drop constraint if exists deal_files_ingest_status_check,
  add constraint deal_files_ingest_status_check
    check (ingest_status in ('uploaded','queued','processing','processed','failed','skipped'));

-- deal_analysis_runs
alter table deal_analysis_runs
  drop constraint if exists deal_analysis_runs_run_type_check,
  add constraint deal_analysis_runs_run_type_check
    check (run_type in ('file_extraction','deal_aggregation','full'));

alter table deal_analysis_runs
  drop constraint if exists deal_analysis_runs_status_check,
  add constraint deal_analysis_runs_status_check
    check (status in ('pending','running','completed','failed','cancelled'));

alter table deal_analysis_runs
  drop constraint if exists deal_analysis_runs_triggered_by_check,
  add constraint deal_analysis_runs_triggered_by_check
    check (triggered_by in ('manual','auto','webhook','system'));

-- deals
alter table deals
  drop constraint if exists deals_status_check,
  add constraint deals_status_check
    check (status in ('new','reviewing','due_diligence','offer','closed','passed'));

-- deal_change_log
alter table deal_change_log
  drop constraint if exists deal_change_log_change_type_check,
  add constraint deal_change_log_change_type_check
    check (change_type in (
      'file_uploaded','entry_added','deal_edited','deal_created',
      'status_changed','analysis_run','note_added'
    ));

-- ── M1: Fix deal_change_log.description nullability ──────────────────────────
-- TypeScript types description as string (non-nullable) but the column was
-- nullable. Set a default empty string and add NOT NULL.
update deal_change_log set description = '' where description is null;
alter table deal_change_log
  alter column description set not null,
  alter column description set default '';

-- ── M2: Missing composite and sort indexes ────────────────────────────────────

-- deal_file_derivatives: queries filter on both deal_id AND user_id
create index if not exists deal_file_derivatives_deal_user_idx
  on deal_file_derivatives(deal_id, user_id);

-- deal_source_claims: listActiveClaimsForDeal orders by extracted_at DESC
create index if not exists deal_source_claims_deal_active_extracted_idx
  on deal_source_claims(deal_id, is_active, extracted_at desc);

-- deal_source_claims: getActiveClaimsForField orders by confidence DESC
create index if not exists deal_source_claims_deal_field_active_conf_idx
  on deal_source_claims(deal_id, field_name, is_active, confidence desc nulls last);

-- ── M3: Fix unnamed user_feedback indexes ────────────────────────────────────
-- Drop auto-named indexes and replace with explicit names
drop index if exists user_feedback_created_at_idx;
drop index if exists user_feedback_user_id_idx;
drop index if exists user_feedback_category_idx;

-- Re-create with explicit names (idempotent due to IF NOT EXISTS)
create index if not exists uf_created_at_idx  on user_feedback(created_at desc);
create index if not exists uf_user_id_idx     on user_feedback(user_id);
create index if not exists uf_category_idx    on user_feedback(category);

-- ── C1: Commit DDL for core tables (documentation + reproducibility) ──────────
-- These tables were created manually in the Supabase dashboard.
-- The CREATE TABLE IF NOT EXISTS below is idempotent on the live DB
-- but ensures any new environment can reproduce the full schema from migrations.

create table if not exists deals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  description           text,
  industry              text,
  location              text,
  status                text not null default 'new',
  asking_price          text,
  sde                   text,
  multiple              text,
  google_drive_folder_id text,
  last_analysis_run_id  uuid,
  current_opinion_id    uuid,
  created_at            timestamptz default now(),
  updated_at            timestamptz not null default now()
);

-- Ensure updated_at column exists on live DB (added by migration 011 trigger but column was missing)
alter table deals add column if not exists updated_at timestamptz not null default now();

create table if not exists deal_sources (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'note',
  title       text,
  content     text not null,
  created_at  timestamptz default now()
);

create table if not exists deal_drive_files (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  deal_id            uuid not null references deals(id) on delete cascade,
  google_file_id     text not null,
  google_file_name   text not null,
  mime_type          text,
  web_view_link      text,
  created_time       timestamptz,
  source_kind        text not null default 'raw_entry',
  original_file_name text,
  created_at         timestamptz default now()
);

create table if not exists google_oauth_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  access_token  text,
  refresh_token text,
  scope         text,
  token_type    text,
  expiry_date   bigint,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists google_drive_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  google_email  text,
  root_folder_id text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Ensure RLS is enabled on all core tables
alter table deals                  enable row level security;
alter table deal_sources           enable row level security;
alter table deal_drive_files       enable row level security;
alter table google_oauth_tokens    enable row level security;
alter table google_drive_connections enable row level security;
