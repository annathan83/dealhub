-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022: Deep Analysis Flow
--
-- 1. Add deep_analysis tracking columns to entities
-- 2. Extend analysis_snapshots.analysis_type to include deep_analysis
-- 3. Extend entity_events.event_type to include deep_analysis events
-- 4. Seed additional deep-fact definitions (broader than triage facts)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add deep analysis tracking to entities ─────────────────────────────────
-- deep_analysis_run_at: timestamp of the last completed deep analysis
-- deep_analysis_stale:  true when new source text has been added since last run

alter table entities
  add column if not exists deep_analysis_run_at  timestamptz,
  add column if not exists deep_analysis_stale   boolean not null default false;

-- ── 2. Extend analysis_snapshots analysis_type check ─────────────────────────
-- Drop and recreate to include deep_analysis type.

alter table analysis_snapshots
  drop constraint if exists analysis_snapshots_analysis_type_check;

alter table analysis_snapshots
  add constraint analysis_snapshots_analysis_type_check
  check (analysis_type in (
    'deal_assessment',
    'valuation',
    'risk_flags',
    'questions',
    'kpi_scorecard',
    'triage_summary',
    'deep_analysis'
  ));

-- ── 3. Extend entity_events event_type check ─────────────────────────────────

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
    'deep_scan_completed',
    'triage_completed',
    'deep_analysis_started',
    'deep_analysis_completed'
  ));

-- ── 4. Seed additional deep fact definitions ──────────────────────────────────
-- These supplement the 34 triage/critical facts already seeded in migration 016.
-- Many of these already exist (revenue_year_1/2, sde_year_1/2, lease_terms, etc.)
-- so we use ON CONFLICT DO NOTHING throughout.

insert into fact_definitions (key, label, description, category, data_type, is_critical, is_multi_value) values

  -- Financial deep facts
  ('ebitda_year_1',          'EBITDA Year −1',              'EBITDA for the year before most recent',                         'financial',   'currency', false, false),
  ('ebitda_year_2',          'EBITDA Year −2',              'EBITDA two years before most recent',                            'financial',   'currency', false, false),
  ('add_backs',              'Owner Add-Backs',             'Total owner add-backs claimed (annual)',                          'financial',   'currency', false, false),
  ('add_backs_detail',       'Add-Backs Detail',            'Itemized description of owner add-backs',                        'financial',   'text',     false, false),
  ('payroll_total',          'Total Payroll',               'Total annual payroll expense',                                    'financial',   'currency', false, false),
  ('rent_annual',            'Annual Rent',                 'Total annual rent / occupancy cost',                              'financial',   'currency', false, false),
  ('capex_annual',           'Annual CapEx',                'Capital expenditure required annually to maintain the business',  'financial',   'currency', false, false),
  ('working_capital_needed', 'Working Capital Needed',      'Estimated working capital required at acquisition',               'financial',   'currency', false, false),
  ('inventory_value',        'Inventory Value',             'Current value of inventory on hand',                              'financial',   'currency', false, false),

  -- Operations deep facts
  ('employee_mix',           'Employee Mix',                'Breakdown of full-time vs part-time vs contractors',              'operations',  'text',     false, false),
  ('owner_role_detail',      'Owner Role Detail',           'Detailed description of what the owner does day-to-day',          'operations',  'text',     false, false),
  ('manager_role_detail',    'Manager Role Detail',         'Whether a manager is in place and what they handle',              'operations',  'text',     false, false),
  ('licenses_required',      'Licenses / Permits Required', 'Key licenses or permits required to operate',                     'operations',  'text',     false, false),
  ('growth_opportunities',   'Growth Opportunities',        'Stated or implied opportunities for growth',                      'operations',  'text',     false, false),
  ('key_risks_detail',       'Key Risks Detail',            'Stated or implied risks to the business',                         'operations',  'text',     false, false),
  ('deal_notes',             'Deal Notes',                  'Miscellaneous notes about the deal',                              'operations',  'text',     false, false),

  -- Deal terms deep facts
  ('seller_financing_detail','Seller Financing Detail',     'Terms and conditions of any seller financing offered',            'deal_terms',  'text',     false, false),
  ('reason_for_sale_detail', 'Reason for Sale Detail',      'Detailed explanation of why the owner is selling',                'deal_terms',  'text',     false, false),
  ('real_estate_detail',     'Real Estate Detail',          'Details about any real estate included or available',             'deal_terms',  'text',     false, false),
  ('lease_renewal_options',  'Lease Renewal Options',       'Number and terms of lease renewal options',                       'deal_terms',  'text',     false, false),

  -- Customer / revenue deep facts
  ('top_customers',          'Top Customers',               'Names or descriptions of top customers and their revenue share',  'operations',  'text',     false, true),
  ('customer_concentration_detail', 'Customer Concentration Detail', 'Detailed breakdown of revenue by customer segment',     'operations',  'text',     false, false),
  ('recurring_revenue_detail','Recurring Revenue Detail',   'Description of recurring revenue streams and contract terms',     'operations',  'text',     false, false)

on conflict (key) do nothing;

-- ── Link new deep facts to the 'deal' entity type ─────────────────────────────
insert into fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
select
  fd.id,
  et.id,
  false,
  1000 + row_number() over (order by fd.label)  -- display after existing facts
from fact_definitions fd
cross join entity_types et
where et.key = 'deal'
  and fd.key in (
    'ebitda_year_1', 'ebitda_year_2', 'add_backs', 'add_backs_detail',
    'payroll_total', 'rent_annual', 'capex_annual', 'working_capital_needed',
    'inventory_value', 'employee_mix', 'owner_role_detail', 'manager_role_detail',
    'licenses_required', 'growth_opportunities', 'key_risks_detail', 'deal_notes',
    'seller_financing_detail', 'reason_for_sale_detail', 'real_estate_detail',
    'lease_renewal_options', 'top_customers', 'customer_concentration_detail',
    'recurring_revenue_detail'
  )
on conflict (fact_definition_id, entity_type_id) do nothing;
