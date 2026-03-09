-- Migration 007: deal_opinions
-- Immutable AI-generated deal-level verdict + narrative.
-- Supersedes deal_insights (which remains for backward compatibility).
-- Run in Supabase dashboard → SQL Editor.

create table if not exists deal_opinions (
  id                    uuid         primary key default gen_random_uuid(),
  deal_id               uuid         not null references deals(id) on delete cascade,
  user_id               uuid         not null references auth.users(id) on delete cascade,
  analysis_run_id       uuid         not null references deal_analysis_runs(id) on delete cascade,
  metric_snapshot_id    uuid         references deal_metric_snapshots(id) on delete set null,

  -- Verdict
  ai_deal_score         integer      check (ai_deal_score between 0 and 100),
  ai_verdict            text,
  -- 'Strong Buy' | 'Proceed with Caution' | 'Needs More Info' | 'Pass'

  -- Narrative outputs (stored as JSONB arrays for easy iteration in UI)
  risk_flags            jsonb        not null default '[]'::jsonb,
  -- [{ "flag": "...", "severity": "high|medium|low", "source_derivative_id": "uuid|null" }]

  missing_information   jsonb        not null default '[]'::jsonb,
  -- ["string", ...]

  broker_questions      jsonb        not null default '[]'::jsonb,
  -- ["string", ...]

  running_summary       text,        -- markdown narrative paragraph
  valuation_context     jsonb,
  -- { "implied_multiple": "...", "revenue_multiple": "...", "sde_multiple": "...", "notes": "..." }

  -- AI cost metadata
  model_name            text,
  input_tokens          integer,
  output_tokens         integer,

  -- Provenance
  derivative_ids_used   jsonb        not null default '[]'::jsonb,
  -- ["uuid", ...] — which derivatives were included in the prompt

  created_at            timestamptz  not null default now()
);

-- Indexes
create index if not exists deal_opinions_deal_id_idx
  on deal_opinions(deal_id);

create index if not exists deal_opinions_deal_created_idx
  on deal_opinions(deal_id, created_at desc);

create index if not exists deal_opinions_run_idx
  on deal_opinions(analysis_run_id);

-- RLS
alter table deal_opinions enable row level security;

create policy "Users manage their own deal opinions"
  on deal_opinions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
