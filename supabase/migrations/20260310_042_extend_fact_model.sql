-- ============================================================================
-- Migration 042: Extend fact model for fact-driven workflow
--
-- Adds:
--   1. Missing fact keys (location_county, location_state, employees_total,
--      lease_years_remaining, capacity, enrollment, payroll)
--   2. Derived fact definitions (price_multiple, sde_margin,
--      revenue_per_employee, sde_per_employee, owner_dependence_level)
--   3. Normalises category values on existing rows that use old names
--   4. Ensures fact_evidence.file_id is nullable (already is, but explicit)
--   5. Adds review_status default to entity_fact_values if missing
-- ============================================================================

-- ── 1. Missing fact keys ──────────────────────────────────────────────────────

INSERT INTO fact_definitions (
  key, label, description, category, data_type,
  fact_scope, is_critical, is_user_visible_initially, is_required_for_kpi,
  display_order
) VALUES
  -- Location sub-fields (split from flat 'location' text)
  ('location_county', 'County',        'County or district of the business',         'operations', 'text',     'triage', false, true,  false, 62),
  ('location_state',  'State',         'State or province of the business',           'operations', 'text',     'triage', false, true,  false, 63),

  -- Employee aggregate (derived from ft + pt but also extractable directly)
  ('employees_total', 'Total Employees','Total headcount (FT + PT)',                  'operations', 'number',   'triage', false, true,  false, 105),

  -- Lease / facility
  ('lease_years_remaining', 'Lease Years Remaining', 'Years left on current lease',  'deal_terms', 'number',   'triage', false, true,  false, 175),

  -- Industry-specific operational facts
  ('capacity',        'Capacity',      'Maximum operational capacity (units/seats/students)', 'operations', 'number', 'triage', false, true, false, 320),
  ('enrollment',      'Enrollment',    'Current enrollment or active customers',      'operations', 'number',   'triage', false, true,  false, 325),

  -- Payroll
  ('payroll',         'Annual Payroll','Total annual payroll / labour cost',          'financial',  'currency', 'triage', false, true,  false, 145),

  -- Seller financing (already exists as 'seller_financing' in deal_terms — this is an alias)
  -- Skip: seller_financing already exists from migration 016

  -- Owner hours alias (owner_hours_per_week already exists — add short alias)
  ('owner_hours',     'Owner Hours / Week (alias)', 'Alias for owner_hours_per_week', 'operations', 'number',   'triage', false, false, false, 295)

ON CONFLICT (key) DO UPDATE
  SET label                   = EXCLUDED.label,
      description             = EXCLUDED.description,
      category                = EXCLUDED.category,
      data_type               = EXCLUDED.data_type,
      fact_scope              = EXCLUDED.fact_scope,
      is_user_visible_initially = EXCLUDED.is_user_visible_initially,
      display_order           = EXCLUDED.display_order;

-- ── 2. Derived fact definitions ───────────────────────────────────────────────
-- These are stored as ai_inferred / system_derived facts so they appear in
-- entity_fact_values and can be displayed in the Facts tab.

INSERT INTO fact_definitions (
  key, label, description, category, data_type,
  fact_scope, is_critical, is_user_visible_initially, is_required_for_kpi,
  display_order
) VALUES
  ('price_multiple',        'Purchase Multiple',    'Asking price ÷ SDE (implied valuation multiple)', 'deal_terms',  'number',  'triage', false, true,  true,  205),
  ('sde_margin',            'SDE Margin',           'SDE ÷ Revenue (profitability ratio)',              'financial',   'percent', 'triage', false, true,  true,  155),
  ('revenue_per_employee',  'Revenue / Employee',   'Revenue ÷ total employees (productivity)',        'operations',  'currency','triage', false, true,  true,  310),
  ('sde_per_employee',      'SDE / Employee',       'SDE ÷ total employees',                           'operations',  'currency','triage', false, false, false, 315),
  ('owner_dependence_level','Owner Dependence',     'Inferred owner dependence level (low/medium/high)','operations', 'text',    'triage', false, true,  true,  290),
  ('rent_ratio',            'Rent Ratio',           'Annual rent ÷ revenue (occupancy cost ratio)',    'deal_terms',  'percent', 'triage', false, true,  true,  180),
  ('utilization_rate',      'Utilization Rate',     'Enrollment ÷ capacity (for capacity businesses)', 'operations',  'percent', 'triage', false, true,  false, 330)

ON CONFLICT (key) DO UPDATE
  SET label                   = EXCLUDED.label,
      description             = EXCLUDED.description,
      category                = EXCLUDED.category,
      data_type               = EXCLUDED.data_type,
      fact_scope              = EXCLUDED.fact_scope,
      is_user_visible_initially = EXCLUDED.is_user_visible_initially,
      is_required_for_kpi     = EXCLUDED.is_required_for_kpi,
      display_order           = EXCLUDED.display_order;

-- ── 3. Link all new facts to the business entity type ─────────────────────────

DO $$
DECLARE
  v_entity_type_id uuid;
  v_fact_id uuid;
BEGIN
  SELECT id INTO v_entity_type_id
  FROM entity_types
  WHERE key IN ('deal', 'business')
  ORDER BY created_at
  LIMIT 1;

  IF v_entity_type_id IS NULL THEN
    RAISE NOTICE 'No deal/business entity type found — skipping link step';
    RETURN;
  END IF;

  FOR v_fact_id IN
    SELECT id FROM fact_definitions
    WHERE key IN (
      'location_county', 'location_state', 'employees_total',
      'lease_years_remaining', 'capacity', 'enrollment', 'payroll', 'owner_hours',
      'price_multiple', 'sde_margin', 'revenue_per_employee', 'sde_per_employee',
      'owner_dependence_level', 'rent_ratio', 'utilization_rate'
    )
  LOOP
    INSERT INTO fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
    VALUES (v_fact_id, v_entity_type_id, false, 9999)
    ON CONFLICT (fact_definition_id, entity_type_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Migration 042: new fact definitions linked to entity type %', v_entity_type_id;
END $$;

-- ── 4. Mark derived facts as system_derived scope ─────────────────────────────
-- These facts are computed, not user-entered, so they should be visually
-- distinguished in the UI. We use fact_scope = 'triage' so they appear in
-- the initial view, but their value_source_type will be 'system_derived'
-- or 'ai_inferred' in entity_fact_values.

UPDATE fact_definitions
SET is_user_visible_initially = true
WHERE key IN (
  'price_multiple', 'sde_margin', 'revenue_per_employee', 'owner_dependence_level',
  'rent_ratio', 'location_county', 'location_state', 'employees_total',
  'lease_years_remaining', 'capacity', 'enrollment', 'payroll'
);

-- ── 5. Ensure entity_fact_values.review_status has a default ─────────────────
-- Already set in migration 026, but be defensive
ALTER TABLE entity_fact_values
  ALTER COLUMN review_status SET DEFAULT 'unreviewed';

-- ── 6. Ensure fact_evidence.file_id is nullable ───────────────────────────────
-- Inferred and manual facts have no source file.
-- This column was already nullable in migration 015, but make it explicit.
ALTER TABLE fact_evidence
  ALTER COLUMN file_id DROP NOT NULL;

-- ── 7. Add is_derived column to fact_definitions ─────────────────────────────
-- Lets the UI distinguish computed/derived facts from raw input facts.
ALTER TABLE fact_definitions
  ADD COLUMN IF NOT EXISTS is_derived boolean NOT NULL DEFAULT false;

UPDATE fact_definitions
SET is_derived = true
WHERE key IN (
  'price_multiple', 'sde_margin', 'revenue_per_employee', 'sde_per_employee',
  'owner_dependence_level', 'rent_ratio', 'utilization_rate',
  'implied_multiple'  -- legacy key from migration 016
);

-- ── 8. Add fact_group column to fact_definitions ──────────────────────────────
-- Maps to the UI grouping categories (separate from the DB category field
-- which uses legacy values like 'financial', 'deal_terms', 'operations').
-- This allows the UI to group facts without changing the DB category column.
ALTER TABLE fact_definitions
  ADD COLUMN IF NOT EXISTS fact_group text NULL;

-- Populate fact_group from existing category + key patterns
UPDATE fact_definitions SET fact_group = 'basic' WHERE key IN (
  'industry', 'location', 'location_county', 'location_state',
  'asking_price', 'sde_latest', 'revenue_latest', 'employees_ft',
  'lease_monthly_rent', 'price_multiple', 'sde_margin'
);

UPDATE fact_definitions SET fact_group = 'financials' WHERE key IN (
  'ebitda_latest', 'revenue_year_1', 'revenue_year_2', 'sde_year_1',
  'gross_profit', 'net_income', 'addbacks_summary', 'financial_quality_notes',
  'recurring_revenue_pct', 'repeat_revenue_pct', 'payroll',
  'customer_concentration_top1_pct', 'customer_concentration_top5_pct',
  'vendor_concentration_top1_pct', 'sde_margin', 'revenue_per_employee',
  'sde_per_employee', 'rent_ratio'
);

UPDATE fact_definitions SET fact_group = 'operations' WHERE key IN (
  'years_in_business', 'seasonality', 'seller_reason', 'reason_for_sale',
  'transition_support', 'capex_intensity', 'working_capital_intensity',
  'capacity', 'enrollment', 'utilization_rate', 'business_type'
);

UPDATE fact_definitions SET fact_group = 'employees_management' WHERE key IN (
  'employees_total', 'employees_pt', 'manager_in_place',
  'owner_hours_per_week', 'owner_hours', 'owner_in_sales', 'owner_in_operations',
  'owner_dependence_level', 'key_employees'
);

UPDATE fact_definitions SET fact_group = 'facility_real_estate' WHERE key IN (
  'lease_monthly_rent', 'lease_expiration_date', 'lease_years_remaining',
  'lease_terms', 'real_estate_included', 'inventory_included',
  'property_address', 'property_size_sqft'
);

UPDATE fact_definitions SET fact_group = 'deal_structure' WHERE key IN (
  'deal_structure', 'seller_financing', 'down_payment', 'implied_multiple',
  'price_multiple'
);

UPDATE fact_definitions SET fact_group = 'market_location' WHERE key IN (
  'location', 'location_county', 'location_state'
);

UPDATE fact_definitions SET fact_group = 'risk_indicators' WHERE key IN (
  'legal_risk_flag', 'compliance_risk_flag', 'licensing_dependency'
);

-- Facts without a group fall into 'other' (handled by UI default)

DO $$ BEGIN
  RAISE NOTICE 'Migration 042 complete: fact model extended for fact-driven workflow';
END $$;
