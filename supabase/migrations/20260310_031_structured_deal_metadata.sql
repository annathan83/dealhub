-- Migration 031: Structured deal metadata
-- Adds structured fields for deal source, location (state/county/city),
-- and industry (category + industry) to the deals table.
-- The legacy `location` and `industry` text columns are preserved for
-- backward compatibility and can be used as display fallbacks.

-- ── Deal source ──────────────────────────────────────────────────────────────
alter table deals
  add column if not exists deal_source_category text,
  add column if not exists deal_source_detail   text;

-- ── Structured location ───────────────────────────────────────────────────────
alter table deals
  add column if not exists state  text,
  add column if not exists county text,
  add column if not exists city   text;

-- ── Structured industry ───────────────────────────────────────────────────────
alter table deals
  add column if not exists industry_category text;

-- ── Indexes for analytics queries ────────────────────────────────────────────
create index if not exists deals_state_idx               on deals (user_id, state)               where state is not null;
create index if not exists deals_county_idx              on deals (user_id, state, county)        where county is not null;
create index if not exists deals_city_idx                on deals (user_id, state, county, city)  where city is not null;
create index if not exists deals_industry_category_idx   on deals (user_id, industry_category)    where industry_category is not null;
create index if not exists deals_industry_idx            on deals (user_id, industry_category, industry) where industry is not null;
create index if not exists deals_source_category_idx     on deals (user_id, deal_source_category) where deal_source_category is not null;
