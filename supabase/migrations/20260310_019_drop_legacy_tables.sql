-- ============================================================================
-- Migration 019: Drop all legacy tables and clean up deals table
--
-- Completes the migration to the entity-fact-evidence architecture.
-- The canonical tables are now:
--   entities, entity_files, file_text, file_chunks
--   fact_definitions, fact_definition_entity_types
--   fact_evidence, entity_fact_values
--   analysis_snapshots, entity_events
--
-- Kept (still serve the timeline/change-log UI):
--   deal_sources, deal_source_analyses, deal_change_log, deal_drive_files
-- ============================================================================

-- 1. Remove legacy pointer columns from deals
alter table deals drop column if exists last_analysis_run_id;
alter table deals drop column if exists current_opinion_id;

-- 2. Drop legacy tables (order matters for FK constraints)
drop table if exists deal_opinion_deltas cascade;
drop table if exists deal_opinions cascade;
drop table if exists deal_metric_snapshots cascade;
drop table if exists deal_analysis_runs cascade;
drop table if exists deal_source_claims cascade;
drop table if exists deal_file_derivatives cascade;
drop table if exists deal_files cascade;
drop table if exists deal_insights cascade;

-- 3. Truncate (reset) the new entity tables for a clean start
truncate table entity_events cascade;
truncate table analysis_snapshots cascade;
truncate table entity_fact_values cascade;
truncate table fact_evidence cascade;
truncate table file_chunks cascade;
truncate table file_text cascade;
truncate table entity_files cascade;

-- 4. Re-bridge existing deals to entities cleanly
delete from entities where legacy_deal_id is not null;

insert into entities (entity_type_id, legacy_deal_id, title, subtitle, status, owner_user_id, created_at, updated_at)
select
  et.id,
  d.id,
  d.name,
  d.industry,
  d.status,
  d.user_id,
  d.created_at,
  coalesce(d.updated_at, d.created_at)
from deals d
cross join entity_types et
where et.key = 'deal'
  and not exists (
    select 1 from entities e where e.legacy_deal_id = d.id
  );
