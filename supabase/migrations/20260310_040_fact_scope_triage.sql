-- ============================================================================
-- Migration 040: Set fact_scope = 'triage' on critical and KPI-scoring facts
--
-- The fact extraction pipeline filters by is_critical = true, but the
-- fact_scope column defaults to 'deep', which means getTriageFactDefinitions()
-- returns nothing. This migration marks the V1 triage scoring facts as
-- fact_scope = 'triage' so they are targeted by the extraction pipeline.
-- ============================================================================

-- Mark all is_critical facts as triage scope
update fact_definitions
set fact_scope = 'triage'
where is_critical = true;

-- Also mark the extended KPI scoring facts that are not is_critical
-- but are essential for the 6-KPI triage model
update fact_definitions
set fact_scope = 'triage'
where key in (
  'asking_price',
  'sde_latest',
  'ebitda_latest',
  'revenue_latest',
  'employees_ft',
  'employees_pt',
  'lease_monthly_rent',
  'manager_in_place',
  'owner_hours_per_week',
  'owner_in_sales',
  'owner_in_operations',
  'recurring_revenue_pct',
  'customer_concentration_top1_pct',
  'years_in_business',
  'industry',
  'location',
  'reason_for_sale',
  'seller_reason'
);

-- Mark triage facts as user_visible_initially so the Facts tab shows them
update fact_definitions
set is_user_visible_initially = true
where fact_scope = 'triage';
