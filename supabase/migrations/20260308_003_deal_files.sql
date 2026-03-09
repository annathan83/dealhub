-- Migration 003: deal_files
-- Provider-agnostic file registry.
-- Replaces the Google-Drive-specific deal_drive_files as the canonical file record.
-- Existing deal_drive_files rows are backfilled in migration 009.
-- Run in Supabase dashboard → SQL Editor.

create table if not exists deal_files (
  id                   uuid         primary key default gen_random_uuid(),
  deal_id              uuid         not null references deals(id) on delete cascade,
  user_id              uuid         not null references auth.users(id) on delete cascade,

  -- Storage provider abstraction — extend without schema changes
  storage_provider     text         not null default 'google_drive',
  -- 'google_drive' | 's3' | 'local' | 'supabase_storage'

  provider_file_id     text,        -- e.g. Google Drive file ID
  provider_file_name   text,        -- name as stored in provider
  web_view_link        text,        -- direct URL to open/preview the file

  -- Original upload metadata
  original_file_name   text         not null,
  mime_type            text,
  size_bytes           bigint,
  checksum_sha256      text,        -- populated on upload for dedup / integrity

  source_kind          text         not null default 'uploaded_file',
  -- 'uploaded_file' | 'webcam_photo' | 'audio_recording'
  -- | 'pasted_text' | 'ai_assessment' | 'manual'

  uploaded_by          uuid         references auth.users(id),
  uploaded_at          timestamptz  not null default now(),

  -- Lifecycle status
  ingest_status        text         not null default 'uploaded',
  -- 'uploaded' | 'queued' | 'processing' | 'processed' | 'failed'

  -- Backfill bridge: points to the legacy deal_drive_files row this was created from
  legacy_drive_file_id uuid,        -- nullable; set during backfill only

  created_at           timestamptz  not null default now()
);

-- Indexes
create index if not exists deal_files_deal_id_idx
  on deal_files(deal_id);

create index if not exists deal_files_deal_id_status_idx
  on deal_files(deal_id, ingest_status);

create index if not exists deal_files_provider_idx
  on deal_files(storage_provider, provider_file_id)
  where provider_file_id is not null;

-- RLS
alter table deal_files enable row level security;

create policy "Users manage their own deal_files"
  on deal_files for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
