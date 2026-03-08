-- Migration: deal_file_derivatives
-- Purpose: Cache per-file extracted text / structured fields so each file is
--          processed by AI exactly once. Future Phase 3 will populate
--          extracted_text and structured_fields; for now rows are inserted
--          immediately on upload with status = 'pending'.
--
-- Run this in the Supabase dashboard → SQL Editor before deploying.

create table if not exists deal_file_derivatives (
  id                  uuid        primary key default gen_random_uuid(),
  deal_id             uuid        not null references deals(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,

  -- Link back to the deal_sources row created for this file/entry
  deal_source_id      uuid        references deal_sources(id) on delete set null,

  -- Google Drive reference (null for pasted-text entries)
  google_file_id      text,
  google_file_name    text,

  -- Original file metadata
  original_file_name  text        not null,
  mime_type           text,

  -- Derived content — populated by Phase 3 extraction pipeline
  file_type           text        not null default 'unknown',
  -- 'pdf' | 'image' | 'audio' | 'text' | 'spreadsheet' | 'unknown'

  extraction_status   text        not null default 'pending',
  -- 'pending' | 'processing' | 'done' | 'failed'

  extracted_text      text,       -- raw text / transcript (populated in Phase 3)
  structured_fields   jsonb,      -- { asking_price, sde, revenue, ... } (Phase 3)

  extraction_model    text,       -- 'whisper-1' | 'gpt-4o-mini' | 'text-extract' | null
  extraction_run_id   text,       -- UUID of the analysis run that produced this
  confidence          text,       -- 'high' | 'medium' | 'low' | null

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indexes for the most common query patterns
create index if not exists deal_file_derivatives_deal_id_idx
  on deal_file_derivatives(deal_id);

create index if not exists deal_file_derivatives_deal_source_id_idx
  on deal_file_derivatives(deal_source_id);

create index if not exists deal_file_derivatives_status_idx
  on deal_file_derivatives(extraction_status)
  where extraction_status = 'pending';

-- Auto-update updated_at on row changes
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deal_file_derivatives_updated_at
  before update on deal_file_derivatives
  for each row execute procedure set_updated_at();

-- Row-Level Security: users can only see their own rows
alter table deal_file_derivatives enable row level security;

create policy "Users can manage their own derivatives"
  on deal_file_derivatives
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
