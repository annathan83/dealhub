-- Migration: add ai_inferred to value_source_type check constraint
--
-- ai_extracted  = AI found a direct quote/number in source material (has evidence snippet)
-- ai_inferred   = AI estimated the value from context without a direct evidence snippet
-- user_override = User manually entered or confirmed the value
-- broker_confirmed / imported / system_derived = future use

ALTER TABLE entity_fact_values
  DROP CONSTRAINT IF EXISTS entity_fact_values_value_source_type_check;

ALTER TABLE entity_fact_values
  ADD CONSTRAINT entity_fact_values_value_source_type_check
  CHECK (value_source_type IN (
    'ai_extracted',
    'ai_inferred',
    'user_override',
    'broker_confirmed',
    'imported',
    'system_derived'
  ));
