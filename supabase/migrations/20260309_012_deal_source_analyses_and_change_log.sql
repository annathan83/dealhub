-- deal_source_analyses: stores AI analysis results for each deal entry
create table if not exists deal_source_analyses (
  id              uuid primary key default gen_random_uuid(),
  deal_source_id  uuid not null references deal_sources(id) on delete cascade,
  deal_id         uuid not null references deals(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  generated_title text,
  detected_type   text,
  summary         text,
  extracted_facts jsonb not null default '{}'::jsonb,
  red_flags       jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  broker_questions    jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists deal_source_analyses_deal_id_idx on deal_source_analyses(deal_id);
create index if not exists deal_source_analyses_source_id_idx on deal_source_analyses(deal_source_id);

alter table deal_source_analyses enable row level security;

create policy "Users can manage their own analyses"
  on deal_source_analyses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- deal_change_log: audit trail of all changes to a deal
create table if not exists deal_change_log (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references deals(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  deal_source_id          uuid references deal_sources(id) on delete set null,
  related_google_file_id  text,
  change_type             text not null,
  title                   text not null,
  description             text,
  created_at              timestamptz not null default now()
);

create index if not exists deal_change_log_deal_id_idx on deal_change_log(deal_id);
create index if not exists deal_change_log_created_at_idx on deal_change_log(created_at desc);

alter table deal_change_log enable row level security;

create policy "Users can manage their own change log"
  on deal_change_log for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
