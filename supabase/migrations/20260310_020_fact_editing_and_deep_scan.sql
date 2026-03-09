-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020: Fact Editing, Deep Scan Status, and Cleanup
--
-- 1. Drop deal_source_claims (confirmed unused in TypeScript codebase)
-- 2. Add fact_edit_log table for manual fact change tracking
-- 3. Add manual_override flag to entity_fact_values (sticky override protection)
-- 4. Add deep_scan_status columns to entities (last scan time, status)
-- 5. Extend entity_events to support new event types
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop deal_source_claims ────────────────────────────────────────────────
-- Confirmed: no TypeScript code reads from or writes to this table.
-- It was created in migration 005 as part of the legacy claim-extraction pipeline
-- which has been fully replaced by fact_evidence + entity_fact_values.
drop table if exists deal_source_claims cascade;

-- ── 2. Add manual_override to entity_fact_values ──────────────────────────────
-- This flag marks facts that were manually confirmed or edited by the user.
-- When true, AI extraction runs will NOT silently overwrite the value.
-- Instead, they will add evidence and mark a conflict if the extracted value differs.
alter table entity_fact_values
  add column if not exists manual_override boolean not null default false,
  add column if not exists override_note text,
  add column if not exists override_by uuid references auth.users(id) on delete set null,
  add column if not exists override_at timestamptz;

-- ── 3. Create fact_edit_log ───────────────────────────────────────────────────
-- Tracks every manual change to a fact value for full auditability.
create table if not exists fact_edit_log (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  fact_definition_id uuid not null references fact_definitions(id) on delete cascade,
  changed_by    uuid not null references auth.users(id) on delete cascade,
  change_type   text not null check (change_type in ('confirm','edit','override','mark_conflict','mark_missing')),
  old_value     text,
  new_value     text,
  old_status    text,
  new_status    text,
  note          text,
  created_at    timestamptz not null default now()
);

-- Index for fast lookups per entity
create index if not exists fact_edit_log_entity_idx on fact_edit_log(entity_id, created_at desc);
create index if not exists fact_edit_log_fact_idx on fact_edit_log(entity_id, fact_definition_id, created_at desc);

-- RLS: users can only see and write their own entity's logs
alter table fact_edit_log enable row level security;

create policy "Users manage own fact_edit_log"
  on fact_edit_log for all
  using (
    exists (
      select 1 from entities e
      where e.id = fact_edit_log.entity_id
        and e.owner_user_id = auth.uid()
    )
  );

-- ── 4. Add deep scan tracking to entities ────────────────────────────────────
-- Tracks the last deep scan run for each entity so the UI can show status.
alter table entities
  add column if not exists deep_scan_status text check (deep_scan_status in ('not_run','running','completed','failed')),
  add column if not exists deep_scan_started_at timestamptz,
  add column if not exists deep_scan_completed_at timestamptz,
  add column if not exists deep_scan_facts_added integer,
  add column if not exists deep_scan_facts_updated integer,
  add column if not exists deep_scan_conflicts_found integer;

-- ── 5. Extend entity_events event_type check ─────────────────────────────────
-- Add new event types for manual edits and deep scan runs.
-- Drop and recreate the check constraint to include new values.
alter table entity_events
  drop constraint if exists entity_events_event_type_check;

alter table entity_events
  add constraint entity_events_event_type_check
  check (event_type in (
    'file_uploaded',
    'text_extracted',
    'facts_extracted',
    'fact_updated',
    'fact_conflict_detected',
    'analysis_refreshed',
    'fact_manually_edited',
    'fact_manually_confirmed',
    'deep_scan_started',
    'deep_scan_completed'
  ));
