-- ─── Migration 032: ai_memories ──────────────────────────────────────────────
-- Durable contextual observations extracted from source material.
-- Separate from structured facts (which are normalized/typed).
-- Separate from analysis_snapshots (which are AI narrative blobs).

create table if not exists ai_memories (
  id              uuid        primary key default gen_random_uuid(),
  entity_id       uuid        not null references entities(id) on delete cascade,
  memory_type     text        not null check (memory_type in ('risk','opportunity','context','flag','question')),
  memory_text     text        not null,
  importance      text        not null default 'medium' check (importance in ('high','medium','low')),
  confidence      numeric(3,2) check (confidence between 0 and 1),
  source_file_id  uuid        references entity_files(id) on delete set null,
  source_excerpt  text,
  status          text        not null default 'active' check (status in ('active','superseded','dismissed')),
  superseded_by   uuid        references ai_memories(id) on delete set null,
  run_id          uuid        references processing_runs(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ai_memories_entity_active_idx
  on ai_memories(entity_id, memory_type) where status = 'active';

create index if not exists ai_memories_entity_created_idx
  on ai_memories(entity_id, created_at desc);

alter table ai_memories enable row level security;

create policy "ai_memories_owner_all"
  on ai_memories for all
  using (
    entity_id in (
      select id from entities where owner_user_id = (select auth.uid())
    )
  );

comment on table ai_memories is
  'Durable contextual observations inferred from source material. Not structured facts, not analysis blobs. Examples: seller open to financing, employee retention risk, landlord relationship important.';
