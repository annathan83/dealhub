-- ============================================================================
-- Migration 018: Extended fact definitions for KPI scoring
--
-- Adds the additional fact keys referenced by the KPI scoring engine
-- and fact registry that were not included in the initial 34-fact seed.
-- All inserts are idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

insert into fact_definitions (key, label, description, category, data_type, is_critical, is_multi_value) values

  -- Financial (extended)
  ('revenue_latest',          'Revenue (Latest Year)',       'Most recent full-year revenue',                          'financial',   'currency', true,  false),
  ('sde_latest',              'SDE (Latest Year)',           'Seller''s Discretionary Earnings, most recent year',     'financial',   'currency', true,  false),
  ('ebitda_latest',           'EBITDA (Latest Year)',        'EBITDA, most recent year',                               'financial',   'currency', true,  false),
  ('revenue_year_1',          'Revenue (Prior Year)',        'Revenue one year before latest',                         'financial',   'currency', false, false),
  ('revenue_year_2',          'Revenue (2 Years Prior)',     'Revenue two years before latest',                        'financial',   'currency', false, false),
  ('sde_year_1',              'SDE (Prior Year)',            'SDE one year before latest',                             'financial',   'currency', false, false),
  ('addbacks_summary',        'Addbacks Summary',            'Summary of owner addbacks to SDE',                       'financial',   'text',     false, false),
  ('financial_quality_notes', 'Financial Quality Notes',     'Notes on financial statement quality or reliability',    'financial',   'text',     false, false),

  -- Deal Terms (extended)
  ('lease_monthly_rent',      'Monthly Rent',                'Monthly lease payment amount',                           'deal_terms',  'currency', false, false),
  ('lease_expiration_date',   'Lease Expiration',            'Date the current lease expires',                         'deal_terms',  'date',     false, false),
  ('working_capital_intensity','Working Capital Intensity',  'Low / medium / high working capital requirement',        'deal_terms',  'text',     false, false),
  ('capex_intensity',         'CapEx Intensity',             'Low / medium / high capital expenditure requirement',    'deal_terms',  'text',     false, false),

  -- Operations (extended)
  ('years_in_business',       'Years in Business',           'How long the business has been operating',               'operations',  'number',   true,  false),
  ('employees_ft',            'Full-Time Employees',         'Number of full-time employees',                          'operations',  'number',   true,  false),
  ('employees_pt',            'Part-Time Employees',         'Number of part-time employees',                          'operations',  'number',   false, false),
  ('owner_in_sales',          'Owner Drives Sales',          'Whether the owner is the primary salesperson',           'operations',  'boolean',  false, false),
  ('owner_in_operations',     'Owner in Operations',         'Whether the owner is required for daily operations',     'operations',  'boolean',  false, false),
  ('manager_in_place',        'Manager in Place',            'Whether a non-owner manager exists',                     'operations',  'boolean',  false, false),
  ('customer_concentration_top1_pct', 'Top Customer %',      'Revenue percentage from top single customer',            'operations',  'percent',  false, false),
  ('customer_concentration_top5_pct', 'Top 5 Customers %',   'Revenue percentage from top 5 customers',               'operations',  'percent',  false, false),
  ('vendor_concentration_top1_pct',   'Top Vendor %',        'Spend percentage from top single vendor',                'operations',  'percent',  false, false),
  ('repeat_revenue_pct',      'Repeat Revenue %',            'Percentage of revenue from repeat customers',            'operations',  'percent',  false, false),
  ('seasonality',             'Seasonality',                 'Low / medium / high revenue seasonality',                'operations',  'text',     false, false),
  ('seller_reason',           'Reason for Sale',             'Why the owner is selling',                               'operations',  'text',     false, false),
  ('transition_support',      'Transition Support',          'Training and handover offered by seller',                'operations',  'text',     false, false),

  -- Risk
  ('legal_risk_flag',         'Legal Risk',                  'Any known legal issues or pending litigation',           'operations',  'boolean',  false, false),
  ('compliance_risk_flag',    'Compliance Risk',             'Any regulatory or compliance concerns',                  'operations',  'boolean',  false, false),
  ('licensing_dependency',    'Licensing Dependency',        'Business depends on specific licenses or permits',       'operations',  'boolean',  false, false)

on conflict (key) do nothing;

-- ── Link new facts to the 'deal' entity type ──────────────────────────────────
insert into fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
select
  fd.id,
  et.id,
  fd.is_critical,
  1000 + row_number() over (order by fd.label) -- append after existing display_order
from fact_definitions fd
cross join entity_types et
where et.key = 'deal'
  and not exists (
    select 1 from fact_definition_entity_types fdet
    where fdet.fact_definition_id = fd.id
      and fdet.entity_type_id = et.id
  );
