-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: Add missing unique constraints
--
-- Two upserts / ON CONFLICT clauses were referencing columns that had no
-- unique constraint, causing:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- 1. entities.legacy_deal_id
--    The bridge_deal_to_entity trigger uses ON CONFLICT (legacy_deal_id) DO NOTHING
--    but there was no unique constraint on that column.
--
-- 2. entity_fact_values(entity_id, fact_definition_id)
--    upsertEntityFactValue uses onConflict: "entity_id,fact_definition_id"
--    but there was no composite unique constraint.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. entities.legacy_deal_id unique constraint ─────────────────────────────
-- Deduplicate first (keep the earliest entity per deal, in case of duplicates)
delete from entities
where id not in (
  select distinct on (legacy_deal_id) id
  from entities
  where legacy_deal_id is not null
  order by legacy_deal_id, created_at asc
);

-- Add partial unique index (only on non-null values — legacy_deal_id is nullable)
create unique index if not exists entities_legacy_deal_id_unique_idx
  on entities (legacy_deal_id)
  where legacy_deal_id is not null;

-- ── 2. entity_fact_values(entity_id, fact_definition_id) unique constraint ───
-- Deduplicate first (keep the most recently updated row per entity+fact pair)
delete from entity_fact_values
where id not in (
  select distinct on (entity_id, fact_definition_id) id
  from entity_fact_values
  order by entity_id, fact_definition_id, updated_at desc nulls last
);

-- Add the composite unique constraint
alter table entity_fact_values
  add constraint entity_fact_values_entity_fact_unique
  unique (entity_id, fact_definition_id);
