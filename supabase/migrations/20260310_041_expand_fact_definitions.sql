-- Migration 041: Expand fact definitions to cover all FACT_REGISTRY keys
--
-- Ensures every key in the frontend FACT_REGISTRY exists in fact_definitions
-- and is linked to the business entity type.
-- Also marks all fact_registry facts as fact_scope='triage' or 'deep' as appropriate.
-- This enables the extraction pipeline to target ALL facts, not just is_critical ones.

-- ── Helper: get the business entity type id ───────────────────────────────────
-- We use a DO block so we can reference the entity_type_id variable

DO $$
DECLARE
  v_entity_type_id uuid;
  v_fact_id uuid;
BEGIN
  -- Get the primary business entity type
  SELECT id INTO v_entity_type_id
  FROM entity_types
  WHERE key = 'business'
  LIMIT 1;

  IF v_entity_type_id IS NULL THEN
    RAISE NOTICE 'No business entity type found — skipping fact definition expansion';
    RETURN;
  END IF;

  -- ── Financial facts ────────────────────────────────────────────────────────

  INSERT INTO fact_definitions (key, label, description, category, data_type, fact_scope, is_critical, is_user_visible_initially, is_required_for_kpi, display_order)
  VALUES
    ('revenue_year_2',        'Revenue (2 Years Prior)',     'Revenue two years before latest',           'financial', 'currency', 'deep',    false, false, false, 120),
    ('gross_profit',          'Gross Profit',                'Revenue minus COGS',                        'financial', 'currency', 'deep',    false, false, false, 130),
    ('net_income',            'Net Income',                  'Bottom-line profit',                        'financial', 'currency', 'deep',    false, false, false, 140),
    ('addbacks_summary',      'Addbacks Summary',            'Summary of owner addbacks',                 'financial', 'text',     'triage',  false, true,  false, 150),
    ('financial_quality_notes','Financial Quality Notes',    'Notes on financial statement quality',      'financial', 'text',     'deep',    false, false, false, 160),
    ('down_payment',          'Down Payment',                'Cash required at close',                    'deal_terms','currency', 'triage',  false, true,  false, 210),
    ('working_capital_intensity','Working Capital Intensity','Low / medium / high',                       'deal_terms','text',     'deep',    false, false, false, 220),
    ('capex_intensity',       'CapEx Intensity',             'Low / medium / high',                       'deal_terms','text',     'deep',    false, false, false, 230),
    ('vendor_concentration_top1_pct','Top Vendor %',         'Spend % from top single vendor',            'operations','percent',  'deep',    false, false, false, 340),
    ('repeat_revenue_pct',    'Repeat Revenue %',            '% of revenue from repeat customers',        'operations','percent',  'triage',  false, true,  false, 350),
    ('seasonality',           'Seasonality',                 'Low / medium / high seasonality',           'operations','text',     'triage',  false, true,  false, 360),
    ('transition_support',    'Transition Support',          'Training / handover offered',               'operations','text',     'triage',  false, true,  false, 370),
    ('customer_concentration_top5_pct','Top 5 Customers %', 'Revenue % from top 5 customers',            'operations','percent',  'triage',  false, true,  false, 380),
    ('legal_risk_flag',       'Legal Risk',                  'Any known legal issues',                    'risk',      'boolean',  'triage',  false, true,  false, 410),
    ('compliance_risk_flag',  'Compliance Risk',             'Any compliance concerns',                   'risk',      'boolean',  'triage',  false, true,  false, 420),
    ('licensing_dependency',  'Licensing Dependency',        'Business depends on specific licenses',     'risk',      'boolean',  'triage',  false, true,  false, 430)
  ON CONFLICT (key) DO UPDATE
    SET label       = EXCLUDED.label,
        description = EXCLUDED.description,
        category    = EXCLUDED.category,
        data_type   = EXCLUDED.data_type;

  -- ── Link all new facts to the business entity type ─────────────────────────
  -- Use a loop to insert missing links only

  FOR v_fact_id IN
    SELECT id FROM fact_definitions
    WHERE key IN (
      'revenue_year_2', 'gross_profit', 'net_income', 'addbacks_summary',
      'financial_quality_notes', 'down_payment', 'working_capital_intensity',
      'capex_intensity', 'vendor_concentration_top1_pct', 'repeat_revenue_pct',
      'seasonality', 'transition_support', 'customer_concentration_top5_pct',
      'legal_risk_flag', 'compliance_risk_flag', 'licensing_dependency'
    )
  LOOP
    INSERT INTO fact_definition_entity_types (fact_definition_id, entity_type_id, is_required, display_order)
    VALUES (v_fact_id, v_entity_type_id, false, 999)
    ON CONFLICT (fact_definition_id, entity_type_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Fact definitions expanded and linked to entity type %', v_entity_type_id;
END $$;

-- ── Mark all triage-relevant facts as user_visible_initially ──────────────────
UPDATE fact_definitions
SET is_user_visible_initially = true
WHERE fact_scope = 'triage';

-- ── Ensure existing key facts have correct scope ──────────────────────────────
UPDATE fact_definitions
SET fact_scope = 'triage'
WHERE key IN (
  'asking_price', 'sde_latest', 'ebitda_latest', 'revenue_latest',
  'revenue_year_1', 'sde_year_1', 'employees_ft', 'employees_pt',
  'lease_monthly_rent', 'lease_expiration_date',
  'manager_in_place', 'owner_hours_per_week', 'owner_in_sales', 'owner_in_operations',
  'recurring_revenue_pct', 'customer_concentration_top1_pct',
  'years_in_business', 'industry', 'location',
  'reason_for_sale', 'seller_reason',
  'deal_structure', 'seller_financing', 'inventory_included', 'real_estate_included',
  'addbacks_summary', 'down_payment', 'repeat_revenue_pct', 'seasonality',
  'transition_support', 'customer_concentration_top5_pct',
  'legal_risk_flag', 'compliance_risk_flag', 'licensing_dependency'
);
