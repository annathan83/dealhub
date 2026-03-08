-- Migration: deal_insights
-- Purpose: Store deal-level AI analysis outputs — score, verdict, risk flags,
--          missing info, broker questions, and a running summary.
--          One row per analysis run; the latest row is the current state.
--          Phase 3 will populate these via analyzeDeal(). For now the table
--          exists so the UI can query it gracefully (returns empty).
--
-- Run this in the Supabase dashboard → SQL Editor before deploying.

create table if not exists deal_insights (
  id                    uuid        primary key default gen_random_uuid(),
  deal_id               uuid        not null references deals(id) on delete cascade,
  user_id               uuid        not null references auth.users(id) on delete cascade,

  -- Analysis run identifier — shared across all rows from the same run
  run_id                text        not null default gen_random_uuid()::text,

  -- AI outputs (all nullable — populated in Phase 3)
  ai_deal_score         integer,    -- 0–100
  ai_verdict            text,
  -- 'Strong Buy' | 'Proceed with Caution' | 'Needs More Info' | 'Pass'

  verdict_reasoning     text,       -- 1–2 sentence explanation

  risk_flags            jsonb       not null default '[]'::jsonb,
  -- [{ "flag": "string", "severity": "high|medium|low", "source_derivative_id": "uuid" }]

  missing_information   jsonb       not null default '[]'::jsonb,
  -- ["string"]

  broker_questions      jsonb       not null default '[]'::jsonb,
  -- ["string"]

  running_summary       text,       -- cumulative deal narrative

  valuation_context     jsonb,
  -- { implied_multiple, revenue_multiple, sde_multiple, notes }

  -- Which derivative rows were used to produce this insight
  source_derivative_ids jsonb       not null default '[]'::jsonb,
  -- ["uuid", ...]

  created_at            timestamptz not null default now()
);

-- Fetch latest insight for a deal efficiently
create index if not exists deal_insights_deal_id_created_idx
  on deal_insights(deal_id, created_at desc);

create index if not exists deal_insights_run_id_idx
  on deal_insights(run_id);

-- Row-Level Security
alter table deal_insights enable row level security;

create policy "Users can manage their own insights"
  on deal_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
