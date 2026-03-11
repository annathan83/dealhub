-- Migration 039: Buyer Profiles
-- Stores one buyer profile per user for buyer-fit analysis.
-- Kept intentionally simple for V1 triage.

create table if not exists buyer_profiles (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references auth.users(id) on delete cascade,

  -- Industry preferences
  preferred_industries            text[]    default '{}',
  excluded_industries             text[]    default '{}',

  -- Financial targets
  target_sde_min                  numeric   null,
  target_sde_max                  numeric   null,
  target_purchase_price_min       numeric   null,
  target_purchase_price_max       numeric   null,

  -- Location
  preferred_locations             text[]    default '{}',

  -- Operational preferences
  max_employees                   integer   null,
  manager_required                text      null check (manager_required in ('yes','no','prefer')),
  owner_operator_ok               text      null check (owner_operator_ok in ('yes','no','prefer')),

  -- Free-text context
  preferred_business_characteristics text   null,
  experience_background           text      null,
  acquisition_goals               text      null,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  -- One profile per user
  unique (user_id)
);

-- RLS: users can only see/edit their own profile
alter table buyer_profiles enable row level security;

create policy "buyer_profiles_select_own"
  on buyer_profiles for select
  using (auth.uid() = user_id);

create policy "buyer_profiles_insert_own"
  on buyer_profiles for insert
  with check (auth.uid() = user_id);

create policy "buyer_profiles_update_own"
  on buyer_profiles for update
  using (auth.uid() = user_id);

create policy "buyer_profiles_delete_own"
  on buyer_profiles for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_buyer_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger buyer_profiles_updated_at
  before update on buyer_profiles
  for each row execute function update_buyer_profiles_updated_at();
