-- ─── Migration 034: Revaluation tracking + DB cleanup ────────────────────────

-- 1. Add incremental revaluation tracking columns to entities
alter table entities
  add column if not exists last_revaluation_at  timestamptz,
  add column if not exists revaluation_stale    boolean not null default false;

-- Backfill: treat existing deep_analysis_run_at as first revaluation baseline
update entities
  set last_revaluation_at = deep_analysis_run_at
  where deep_analysis_run_at is not null
    and last_revaluation_at is null;

comment on column entities.last_revaluation_at is
  'Timestamp of the last completed incremental revaluation run.';
comment on column entities.revaluation_stale is
  'True when a meaningful change occurred after the last revaluation (new file, fact change, user override).';

-- 2. Extend analysis_snapshots CHECK constraint to allow revaluation type
alter table analysis_snapshots
  drop constraint if exists analysis_snapshots_analysis_type_check;

alter table analysis_snapshots
  add constraint analysis_snapshots_analysis_type_check
  check (analysis_type = any (array[
    'deal_assessment'::text,
    'valuation'::text,
    'risk_flags'::text,
    'questions'::text,
    'kpi_scorecard'::text,
    'triage_summary'::text,
    'deep_analysis'::text,
    'revaluation'::text
  ]));

-- 3. Extend processing_runs CHECK constraint to allow incremental_revaluation type
alter table processing_runs
  drop constraint if exists processing_runs_run_type_check;

alter table processing_runs
  add constraint processing_runs_run_type_check
  check (run_type = any (array[
    'text_extraction'::text,
    'ocr'::text,
    'transcription'::text,
    'fact_extraction'::text,
    'triage_generation'::text,
    'incremental_revaluation'::text,
    'deep_scan'::text,
    'deep_analysis'::text,
    'kpi_scoring'::text,
    'valuation_support'::text
  ]));

-- 4. Extend entity_events CHECK constraint to allow revaluation_completed
alter table entity_events
  drop constraint if exists entity_events_event_type_check;

alter table entity_events
  add constraint entity_events_event_type_check
  check (event_type = any (array[
    'file_uploaded'::text,
    'file_removed'::text,
    'text_extracted'::text,
    'ocr_completed'::text,
    'transcript_completed'::text,
    'facts_extracted'::text,
    'fact_updated'::text,
    'fact_conflict_detected'::text,
    'fact_manually_edited'::text,
    'fact_manually_confirmed'::text,
    'manual_override_applied'::text,
    'analysis_refreshed'::text,
    'revaluation_completed'::text,
    'deep_scan_started'::text,
    'deep_scan_completed'::text,
    'triage_completed'::text,
    'deep_analysis_started'::text,
    'deep_analysis_completed'::text,
    'initial_review_completed'::text,
    'entity_passed'::text,
    'entity_archived'::text,
    'entity_deleted'::text,
    'status_changed'::text,
    'deal_edited'::text,
    'entry_added'::text
  ]));

-- 5. Fix duplicate indexes
drop index if exists entities_legacy_deal_idx;
drop index if exists efv_entity_fact_unique;
drop index if exists uf_category_idx;
drop index if exists uf_created_at_idx;
drop index if exists uf_user_id_idx;

-- 6. Fix RLS policies to use (select auth.uid()) for performance

-- deals
drop policy if exists "Users select own deals" on deals;
drop policy if exists "Users insert own deals" on deals;
drop policy if exists "Users update own deals" on deals;
drop policy if exists "Users delete own deals" on deals;
create policy "deals_select" on deals for select using (user_id = (select auth.uid()));
create policy "deals_insert" on deals for insert with check (user_id = (select auth.uid()));
create policy "deals_update" on deals for update using (user_id = (select auth.uid()));
create policy "deals_delete" on deals for delete using (user_id = (select auth.uid()));

-- deal_sources
drop policy if exists "Users select own sources" on deal_sources;
drop policy if exists "Users insert own sources" on deal_sources;
drop policy if exists "Users update own sources" on deal_sources;
drop policy if exists "Users delete own sources" on deal_sources;
create policy "deal_sources_select" on deal_sources for select using (user_id = (select auth.uid()));
create policy "deal_sources_insert" on deal_sources for insert with check (user_id = (select auth.uid()));
create policy "deal_sources_update" on deal_sources for update using (user_id = (select auth.uid()));
create policy "deal_sources_delete" on deal_sources for delete using (user_id = (select auth.uid()));

-- google_oauth_tokens
drop policy if exists "Users manage own oauth tokens" on google_oauth_tokens;
create policy "google_oauth_tokens_all" on google_oauth_tokens for all using (user_id = (select auth.uid()));

-- google_drive_connections
drop policy if exists "Users manage own drive connection" on google_drive_connections;
create policy "google_drive_connections_all" on google_drive_connections for all using (user_id = (select auth.uid()));

-- deal_drive_files
drop policy if exists "Users manage own drive files" on deal_drive_files;
create policy "deal_drive_files_all" on deal_drive_files for all using (user_id = (select auth.uid()));

-- user_feedback
drop policy if exists "Users can submit feedback" on user_feedback;
drop policy if exists "Users can view own feedback" on user_feedback;
create policy "user_feedback_all" on user_feedback for all using (user_id = (select auth.uid()));

-- deal_source_analyses
drop policy if exists "Users can manage their own analyses" on deal_source_analyses;
create policy "deal_source_analyses_all" on deal_source_analyses for all using (user_id = (select auth.uid()));

-- deal_change_log
drop policy if exists "Users can manage their own change log" on deal_change_log;
create policy "deal_change_log_all" on deal_change_log for all using (user_id = (select auth.uid()));

-- entity_types
drop policy if exists "Authenticated users can read entity_types" on entity_types;
create policy "entity_types_select" on entity_types for select using ((select auth.uid()) is not null);

-- entities
drop policy if exists "Users manage own entities" on entities;
create policy "entities_all" on entities for all using (owner_user_id = (select auth.uid()));

-- entity_files
drop policy if exists "Users manage own entity_files" on entity_files;
create policy "entity_files_all" on entity_files for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- file_texts
drop policy if exists "Users manage own file_text" on file_texts;
create policy "file_texts_all" on file_texts for all
  using (file_id in (select ef.id from entity_files ef join entities e on e.id = ef.entity_id where e.owner_user_id = (select auth.uid())));

-- file_chunks
drop policy if exists "Users manage own file_chunks" on file_chunks;
create policy "file_chunks_all" on file_chunks for all
  using (file_id in (select ef.id from entity_files ef join entities e on e.id = ef.entity_id where e.owner_user_id = (select auth.uid())));

-- fact_definitions
drop policy if exists "Authenticated users can read fact_definitions" on fact_definitions;
create policy "fact_definitions_select" on fact_definitions for select using ((select auth.uid()) is not null);

-- fact_definition_entity_types
drop policy if exists "Authenticated users can read fact_definition_entity_types" on fact_definition_entity_types;
create policy "fact_definition_entity_types_select" on fact_definition_entity_types for select using ((select auth.uid()) is not null);

-- fact_evidence
drop policy if exists "Users manage own fact_evidence" on fact_evidence;
create policy "fact_evidence_all" on fact_evidence for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- entity_fact_values
drop policy if exists "Users manage own entity_fact_values" on entity_fact_values;
create policy "entity_fact_values_all" on entity_fact_values for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- analysis_snapshots
drop policy if exists "Users manage own analysis_snapshots" on analysis_snapshots;
create policy "analysis_snapshots_all" on analysis_snapshots for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- entity_events
drop policy if exists "Users manage own entity_events" on entity_events;
create policy "entity_events_all" on entity_events for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- fact_edit_log
drop policy if exists "Users manage own fact_edit_log" on fact_edit_log;
create policy "fact_edit_log_all" on fact_edit_log for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- processing_runs
drop policy if exists "processing_runs_owner_select" on processing_runs;
drop policy if exists "processing_runs_owner_insert" on processing_runs;
drop policy if exists "processing_runs_owner_update" on processing_runs;
create policy "processing_runs_all" on processing_runs for all
  using (entity_id in (select id from entities where owner_user_id = (select auth.uid())));

-- 7. Fix function search_path security warnings
create or replace function public.update_updated_at()
  returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_updated_at()
  returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.bump_deal_updated_at()
  returns trigger language plpgsql security definer set search_path = public
as $$ begin update deals set updated_at = now() where id = new.deal_id; return new; end; $$;

create or replace function public.assign_deal_number()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.deal_number is null then
    select coalesce(max(deal_number), 0) + 1 into new.deal_number from deals where user_id = new.user_id;
  end if;
  return new;
end; $$;

create or replace function public.bridge_deal_to_entity()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare v_entity_type_id uuid;
begin
  select id into v_entity_type_id from entity_types where key = 'deal' limit 1;
  if v_entity_type_id is null then return new; end if;
  insert into entities (entity_type_id, legacy_deal_id, title, subtitle, status, owner_user_id, metadata_json, created_at, updated_at)
  values (v_entity_type_id, new.id, new.name, new.industry, new.status, new.user_id,
    jsonb_build_object('deal_number', new.deal_number, 'location', new.location, 'asking_price', new.asking_price, 'sde', new.sde, 'multiple', new.multiple),
    new.created_at, new.updated_at)
  on conflict (legacy_deal_id) do nothing;
  return new;
end; $$;

create or replace function public.sync_deal_to_entity()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update entities set title = new.name, subtitle = new.industry, status = new.status,
    metadata_json = jsonb_build_object('deal_number', new.deal_number, 'location', new.location, 'asking_price', new.asking_price, 'sde', new.sde, 'multiple', new.multiple),
    updated_at = now()
  where legacy_deal_id = new.id;
  return new;
end; $$;

-- 8. Add missing FK indexes for performance
create index if not exists deal_change_log_deal_source_id_idx on deal_change_log(deal_source_id);
create index if not exists deal_change_log_user_id_idx on deal_change_log(user_id);
create index if not exists deal_drive_files_deal_id_idx on deal_drive_files(deal_id);
create index if not exists deal_drive_files_user_id_idx on deal_drive_files(user_id);
create index if not exists deal_source_analyses_user_id_idx on deal_source_analyses(user_id);
create index if not exists deal_sources_deal_id_idx on deal_sources(deal_id);
create index if not exists deal_sources_user_id_idx on deal_sources(user_id);
create index if not exists entity_events_actor_user_id_idx on entity_events(actor_user_id) where actor_user_id is not null;
create index if not exists entity_events_fact_definition_id_idx on entity_events(fact_definition_id) where fact_definition_id is not null;
create index if not exists entity_events_file_id_idx on entity_events(file_id) where file_id is not null;
create index if not exists entity_fact_values_confirmed_by_idx on entity_fact_values(confirmed_by_user_id) where confirmed_by_user_id is not null;
create index if not exists entity_fact_values_current_evidence_idx on entity_fact_values(current_evidence_id) where current_evidence_id is not null;
create index if not exists entity_fact_values_fact_definition_idx on entity_fact_values(fact_definition_id);
create index if not exists entity_files_uploaded_by_idx on entity_files(uploaded_by) where uploaded_by is not null;
create index if not exists fact_edit_log_changed_by_idx on fact_edit_log(changed_by);
create index if not exists fact_edit_log_fact_definition_idx on fact_edit_log(fact_definition_id);
create index if not exists fact_evidence_file_chunk_id_idx on fact_evidence(file_chunk_id) where file_chunk_id is not null;
create index if not exists processing_runs_related_file_idx on processing_runs(related_file_id) where related_file_id is not null;
create index if not exists processing_runs_related_text_idx on processing_runs(related_text_id) where related_text_id is not null;
create index if not exists processing_runs_triggered_by_user_idx on processing_runs(triggered_by_user_id) where triggered_by_user_id is not null;
create index if not exists user_feedback_deal_id_idx on user_feedback(deal_id) where deal_id is not null;
