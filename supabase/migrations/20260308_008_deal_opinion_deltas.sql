-- Migration 008: deal_opinion_deltas
-- Stores the diff between two consecutive deal_opinions.
-- Generated deterministically by DealOpinionDeltaService.
-- Run in Supabase dashboard → SQL Editor.

create table if not exists deal_opinion_deltas (
  id                    uuid         primary key default gen_random_uuid(),
  deal_id               uuid         not null references deals(id) on delete cascade,
  user_id               uuid         not null references auth.users(id) on delete cascade,

  -- The two opinions being compared (from_opinion may be null for the first run)
  from_opinion_id       uuid         references deal_opinions(id) on delete set null,
  to_opinion_id         uuid         not null references deal_opinions(id) on delete cascade,

  -- Score delta
  score_before          integer,
  score_after           integer,
  score_change          integer,     -- to - from (positive = improved)

  -- Verdict change
  verdict_before        text,
  verdict_after         text,
  verdict_changed       boolean      not null default false,

  -- Metric changes (only fields that changed)
  changed_metrics       jsonb        not null default '{}'::jsonb,
  -- { "asking_price": { "before": 500000, "after": 480000 }, ... }

  -- Risk flag changes
  added_risks           jsonb        not null default '[]'::jsonb,
  -- [{ "flag": "...", "severity": "..." }]
  removed_risks         jsonb        not null default '[]'::jsonb,

  -- Missing info changes
  resolved_missing      jsonb        not null default '[]'::jsonb,
  -- items that were in from_opinion.missing_information but not in to_opinion
  new_missing           jsonb        not null default '[]'::jsonb,

  -- Which files triggered this re-analysis
  triggering_file_ids   jsonb        not null default '[]'::jsonb,
  -- ["uuid", ...] — references deal_files.id

  created_at            timestamptz  not null default now()
);

-- Indexes
create index if not exists deal_opinion_deltas_deal_id_idx
  on deal_opinion_deltas(deal_id);

create index if not exists deal_opinion_deltas_to_opinion_idx
  on deal_opinion_deltas(to_opinion_id);

create index if not exists deal_opinion_deltas_deal_created_idx
  on deal_opinion_deltas(deal_id, created_at desc);

-- RLS
alter table deal_opinion_deltas enable row level security;

create policy "Users manage their own opinion deltas"
  on deal_opinion_deltas for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
