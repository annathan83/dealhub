-- ============================================================================
-- Migration 016: Seed entity_types and fact_definitions
-- ============================================================================

-- ── Entity types ──────────────────────────────────────────────────────────────
insert into entity_types (key, label, description) values
  ('deal',     'Business Acquisition Deal', 'A business being evaluated for acquisition'),
  ('property', 'Real Estate Property',      'A property being evaluated for purchase or lease'),
  ('case',     'Legal / Advisory Case',     'A legal or advisory case'),
  ('project',  'Project',                   'A generic project or initiative')
on conflict (key) do nothing;

-- ── Fact definitions (34 facts) ───────────────────────────────────────────────
insert into fact_definitions (key, label, description, category, data_type, is_critical, is_multi_value) values

  -- Financial (critical)
  ('asking_price',           'Asking Price',                'Seller''s stated asking price',                                   'financial',   'currency', true,  false),
  ('sde',                    'Seller''s Discretionary Earnings', 'SDE / owner benefit (annual)',                               'financial',   'currency', true,  false),
  ('ebitda',                 'EBITDA',                      'Earnings before interest, taxes, depreciation & amortisation',   'financial',   'currency', true,  false),
  ('revenue',                'Annual Revenue',              'Total annual revenue (most recent full year)',                    'financial',   'currency', true,  false),
  ('gross_profit',           'Gross Profit',                'Revenue minus cost of goods sold',                               'financial',   'currency', false, false),
  ('net_income',             'Net Income',                  'Bottom-line profit after all expenses and taxes',                'financial',   'currency', false, false),
  ('revenue_trend',          'Revenue Trend',               'Direction of revenue over the past 3 years',                     'financial',   'text',     false, false),
  ('revenue_year_1',         'Revenue Year −1',             'Revenue for the year before most recent',                        'financial',   'currency', false, false),
  ('revenue_year_2',         'Revenue Year −2',             'Revenue two years before most recent',                           'financial',   'currency', false, false),
  ('sde_year_1',             'SDE Year −1',                 'SDE for the year before most recent',                            'financial',   'currency', false, false),
  ('sde_year_2',             'SDE Year −2',                 'SDE two years before most recent',                               'financial',   'currency', false, false),

  -- Deal terms (critical)
  ('implied_multiple',       'Implied Multiple',            'Asking price ÷ SDE (or EBITDA)',                                 'deal_terms',  'number',   true,  false),
  ('deal_structure',         'Deal Structure',              'Asset sale, share sale, earnout, seller finance, etc.',          'deal_terms',  'text',     true,  false),
  ('seller_financing',       'Seller Financing',            'Amount or % the seller is willing to finance',                   'deal_terms',  'currency', false, false),
  ('down_payment',           'Down Payment Required',       'Cash required at close',                                         'deal_terms',  'currency', false, false),
  ('inventory_included',     'Inventory Included',          'Whether inventory is included in the asking price',              'deal_terms',  'boolean',  false, false),
  ('real_estate_included',   'Real Estate Included',        'Whether real estate is included in the asking price',            'deal_terms',  'boolean',  false, false),
  ('lease_terms',            'Lease Terms',                 'Remaining lease term and renewal options',                       'deal_terms',  'text',     false, false),

  -- Operations (critical)
  ('business_age',           'Years in Business',           'Number of years the business has been operating',                'operations',  'number',   true,  false),
  ('employee_count',         'Employee Count',              'Number of full-time and part-time employees',                    'operations',  'number',   true,  false),
  ('owner_hours_per_week',   'Owner Hours / Week',          'Hours per week the current owner works in the business',         'operations',  'number',   false, false),
  ('customer_concentration', 'Customer Concentration',      'Percentage of revenue from top 1–3 customers',                   'operations',  'percent',  false, false),
  ('recurring_revenue_pct',  'Recurring Revenue %',         'Percentage of revenue that is recurring or contracted',          'operations',  'percent',  false, false),
  ('industry',               'Industry / Sector',           'Primary industry or sector of the business',                     'operations',  'text',     false, false),
  ('location',               'Business Location',           'City, state/province, country',                                  'operations',  'text',     false, false),
  ('business_type',          'Business Type',               'B2B, B2C, franchise, e-commerce, SaaS, etc.',                    'operations',  'text',     false, false),
  ('reason_for_sale',        'Reason for Sale',             'Stated reason the owner is selling',                             'operations',  'text',     false, false),

  -- People
  ('owner_name',             'Owner Name',                  'Name of the current owner(s)',                                   'people',      'text',     false, true),
  ('broker_name',            'Broker Name',                 'Name of the listing broker or agent',                            'people',      'text',     false, false),
  ('broker_contact',         'Broker Contact',              'Broker email or phone number',                                   'people',      'text',     false, false),
  ('key_employees',          'Key Employees',               'Names and roles of key employees',                               'people',      'text',     false, true),

  -- Real estate (non-critical, used for property entity type too)
  ('property_address',       'Property Address',            'Full street address of the property',                            'real_estate', 'text',     false, false),
  ('property_size_sqft',     'Property Size (sq ft)',       'Total square footage of the property',                           'real_estate', 'number',   false, false),
  ('cap_rate',               'Cap Rate',                    'Capitalisation rate for real estate',                            'real_estate', 'percent',  false, false)

on conflict (key) do nothing;

-- ── Link all 34 facts to the 'deal' entity type ───────────────────────────────
insert into fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
select
  fd.id,
  et.id,
  fd.is_critical,
  row_number() over (order by
    case fd.category
      when 'financial'   then 1
      when 'deal_terms'  then 2
      when 'operations'  then 3
      when 'people'      then 4
      when 'real_estate' then 5
      else 6
    end,
    fd.is_critical desc,
    fd.label
  ) as display_order
from fact_definitions fd
cross join entity_types et
where et.key = 'deal'
on conflict (fact_definition_id, entity_type_id) do nothing;

-- ── Link real_estate facts to the 'property' entity type ─────────────────────
insert into fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
select
  fd.id,
  et.id,
  false,
  row_number() over (order by fd.label)
from fact_definitions fd
cross join entity_types et
where et.key = 'property'
  and fd.category in ('real_estate', 'financial', 'deal_terms')
on conflict (fact_definition_id, entity_type_id) do nothing;
