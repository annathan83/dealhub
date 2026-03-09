-- Migration 006: deal_metric_snapshots
-- Point-in-time snapshot of computed deal metrics at the moment of each analysis run.
-- Enables delta tracking: "what changed since last run?"
-- Run in Supabase dashboard → SQL Editor.

create table if not exists deal_metric_snapshots (
  id                  uuid         primary key default gen_random_uuid(),
  deal_id             uuid         not null references deals(id) on delete cascade,
  user_id             uuid         not null references auth.users(id) on delete cascade,
  analysis_run_id     uuid         not null references deal_analysis_runs(id) on delete cascade,

  -- Core financial metrics (all nullable — only set when extracted)
  asking_price        numeric,
  revenue             numeric,
  sde                 numeric,
  ebitda              numeric,
  gross_profit        numeric,
  net_income          numeric,
  total_assets        numeric,
  total_liabilities   numeric,

  -- Computed multiples
  implied_multiple    numeric(6,2),
  revenue_multiple    numeric(6,2),
  sde_multiple        numeric(6,2),

  -- Operational metrics
  employee_count      integer,
  year_established    integer,
  years_in_business   integer,

  -- Snapshot metadata
  currency            text         not null default 'USD',
  snapshot_notes      text,
  source_claim_ids    jsonb        not null default '[]'::jsonb,
  -- ["uuid", ...] — references deal_source_claims.id that contributed

  created_at          timestamptz  not null default now()
);

-- Indexes
create index if not exists deal_metric_snapshots_deal_id_idx
  on deal_metric_snapshots(deal_id);

create index if not exists deal_metric_snapshots_run_idx
  on deal_metric_snapshots(analysis_run_id);

create index if not exists deal_metric_snapshots_deal_created_idx
  on deal_metric_snapshots(deal_id, created_at desc);

-- RLS
alter table deal_metric_snapshots enable row level security;

create policy "Users manage their own metric snapshots"
  on deal_metric_snapshots for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
