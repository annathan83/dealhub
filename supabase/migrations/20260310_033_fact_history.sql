-- ─── Migration 033: fact_history ─────────────────────────────────────────────
-- Unified structured diff log covering both AI-driven fact changes and
-- user overrides. Complements entity_events (which is the timeline log)
-- and fact_edit_log (which only covers manual edits).

create table if not exists fact_history (
  id              uuid        primary key default gen_random_uuid(),
  entity_id       uuid        not null references entities(id) on delete cascade,
  record_type     text        not null check (record_type in ('structured_fact','ai_memory')),
  record_id       uuid        not null,
  action          text        not null check (action in ('created','updated','superseded','overridden','dismissed','confirmed','deleted')),
  old_value_json  jsonb,
  new_value_json  jsonb,
  reason          text,
  source_file_id  uuid        references entity_files(id) on delete set null,
  run_id          uuid        references processing_runs(id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      text        not null default 'system'
);

create index if not exists fact_history_entity_idx
  on fact_history(entity_id, created_at desc);

create index if not exists fact_history_record_idx
  on fact_history(record_id, created_at desc);

alter table fact_history enable row level security;

create policy "fact_history_owner_all"
  on fact_history for all
  using (
    entity_id in (
      select id from entities where owner_user_id = (select auth.uid())
    )
  );

comment on table fact_history is
  'Structured diff log for all fact and ai_memory changes. Covers AI-driven changes, user overrides, confirmations, and dismissals. Source of truth for change awareness in revaluation.';
