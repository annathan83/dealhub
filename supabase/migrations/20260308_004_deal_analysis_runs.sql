-- Migration 004: deal_analysis_runs
-- Immutable record of every extraction or aggregation run.
-- Nothing in this table is ever overwritten.
-- Run in Supabase dashboard → SQL Editor.

create table if not exists deal_analysis_runs (
  id               uuid         primary key default gen_random_uuid(),
  deal_id          uuid         not null references deals(id) on delete cascade,
  user_id          uuid         not null references auth.users(id) on delete cascade,

  run_type         text         not null,
  -- 'file_extraction' | 'deal_aggregation'

  triggered_by     text         not null default 'system',
  -- 'upload' | 'entry' | 'manual' | 'system' | 'backfill'

  status           text         not null default 'pending',
  -- 'pending' | 'running' | 'completed' | 'failed'

  started_at       timestamptz  not null default now(),
  completed_at     timestamptz,

  -- AI cost tracking (populated when AI is invoked in Phase 4)
  model_name       text,
  input_tokens     integer,
  output_tokens    integer,
  cost_estimate    numeric(10,6),

  notes            text,
  error_message    text,

  -- Which files / derivatives were inputs to this run
  source_file_ids  jsonb        not null default '[]'::jsonb,
  -- ["uuid", ...]  — references deal_files.id
  derivative_ids   jsonb        not null default '[]'::jsonb,
  -- ["uuid", ...]  — references deal_file_derivatives.id

  created_at       timestamptz  not null default now()
);

-- Indexes
create index if not exists deal_analysis_runs_deal_id_idx
  on deal_analysis_runs(deal_id);

create index if not exists deal_analysis_runs_deal_type_status_idx
  on deal_analysis_runs(deal_id, run_type, status);

create index if not exists deal_analysis_runs_created_idx
  on deal_analysis_runs(deal_id, created_at desc);

-- RLS
alter table deal_analysis_runs enable row level security;

create policy "Users manage their own analysis runs"
  on deal_analysis_runs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
