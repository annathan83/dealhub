-- Migration 005: deal_source_claims
-- Atomic, evidence-linked extracted facts.
-- Every AI-extracted number or statement is stored here with its source.
-- Run in Supabase dashboard → SQL Editor.

create table if not exists deal_source_claims (
  id                    uuid         primary key default gen_random_uuid(),
  deal_id               uuid         not null references deals(id) on delete cascade,
  user_id               uuid         not null references auth.users(id) on delete cascade,
  analysis_run_id       uuid         references deal_analysis_runs(id) on delete set null,

  -- Source provenance
  source_file_id        uuid         references deal_files(id) on delete set null,
  source_derivative_id  uuid         references deal_file_derivatives(id) on delete set null,
  source_deal_source_id uuid         references deal_sources(id) on delete set null,

  -- The claim itself
  field_name            text         not null,
  -- e.g. 'asking_price', 'sde', 'revenue', 'employee_count', 'risk_note'

  raw_value             text,        -- the extracted string before coercion
  numeric_value         numeric,     -- populated when field is numeric
  text_value            text,        -- populated for non-numeric fields
  unit                  text,        -- 'USD', 'CAD', 'count', etc.

  -- AI metadata
  confidence            numeric(4,3) check (confidence between 0 and 1),
  extraction_model      text,
  extraction_run_id     text,        -- matches deal_analysis_runs.id (as text for flexibility)

  -- Conflict resolution: newer claims can supersede older ones
  superseded_by         uuid         references deal_source_claims(id) on delete set null,
  is_active             boolean      not null default true,

  extracted_at          timestamptz  not null default now(),
  created_at            timestamptz  not null default now()
);

-- Indexes
create index if not exists deal_source_claims_deal_id_idx
  on deal_source_claims(deal_id);

create index if not exists deal_source_claims_deal_field_active_idx
  on deal_source_claims(deal_id, field_name, is_active);

create index if not exists deal_source_claims_run_idx
  on deal_source_claims(analysis_run_id)
  where analysis_run_id is not null;

-- RLS
alter table deal_source_claims enable row level security;

create policy "Users manage their own source claims"
  on deal_source_claims for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
