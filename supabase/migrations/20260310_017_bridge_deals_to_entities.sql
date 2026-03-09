-- ============================================================================
-- Migration 017: Bridge existing deals rows into the entities table
--
-- For every existing deal, insert a corresponding entity row using
-- legacy_deal_id as the bridge key. Idempotent — safe to re-run.
-- ============================================================================

insert into entities (
  entity_type_id,
  legacy_deal_id,
  title,
  subtitle,
  status,
  owner_user_id,
  metadata_json,
  created_at,
  updated_at
)
select
  et.id                                          as entity_type_id,
  d.id                                           as legacy_deal_id,
  d.name                                         as title,
  d.industry                                     as subtitle,
  d.status                                       as status,
  d.user_id                                      as owner_user_id,
  jsonb_build_object(
    'deal_number',    d.deal_number,
    'location',       d.location,
    'asking_price',   d.asking_price,
    'sde',            d.sde,
    'multiple',       d.multiple
  )                                              as metadata_json,
  d.created_at,
  d.updated_at
from deals d
cross join entity_types et
where et.key = 'deal'
  and not exists (
    select 1 from entities e where e.legacy_deal_id = d.id
  );

-- ── Trigger: auto-bridge new deals into entities ──────────────────────────────
create or replace function bridge_deal_to_entity()
returns trigger language plpgsql as $$
declare
  v_entity_type_id uuid;
begin
  select id into v_entity_type_id from entity_types where key = 'deal' limit 1;
  if v_entity_type_id is null then
    return new;  -- entity_types not seeded yet — skip gracefully
  end if;

  insert into entities (
    entity_type_id,
    legacy_deal_id,
    title,
    subtitle,
    status,
    owner_user_id,
    metadata_json,
    created_at,
    updated_at
  ) values (
    v_entity_type_id,
    new.id,
    new.name,
    new.industry,
    new.status,
    new.user_id,
    jsonb_build_object(
      'deal_number',  new.deal_number,
      'location',     new.location,
      'asking_price', new.asking_price,
      'sde',          new.sde,
      'multiple',     new.multiple
    ),
    new.created_at,
    new.updated_at
  )
  on conflict (legacy_deal_id) do nothing;

  return new;
end;
$$;

drop trigger if exists deals_bridge_to_entity on deals;
create trigger deals_bridge_to_entity
  after insert on deals
  for each row execute procedure bridge_deal_to_entity();

-- ── Trigger: keep entity title/status in sync when deal is updated ────────────
create or replace function sync_deal_to_entity()
returns trigger language plpgsql as $$
begin
  update entities
  set
    title        = new.name,
    subtitle     = new.industry,
    status       = new.status,
    metadata_json = jsonb_build_object(
      'deal_number',  new.deal_number,
      'location',     new.location,
      'asking_price', new.asking_price,
      'sde',          new.sde,
      'multiple',     new.multiple
    ),
    updated_at   = now()
  where legacy_deal_id = new.id;
  return new;
end;
$$;

drop trigger if exists deals_sync_to_entity on deals;
create trigger deals_sync_to_entity
  after update on deals
  for each row execute procedure sync_deal_to_entity();
