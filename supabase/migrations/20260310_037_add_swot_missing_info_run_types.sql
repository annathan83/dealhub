-- Migration: add swot_analysis and missing_info_detection to processing_runs run_type check constraint

ALTER TABLE processing_runs
  DROP CONSTRAINT IF EXISTS processing_runs_run_type_check;

ALTER TABLE processing_runs
  ADD CONSTRAINT processing_runs_run_type_check
  CHECK (run_type IN (
    'text_extraction',
    'ocr',
    'transcription',
    'fact_extraction',
    'triage_generation',
    'incremental_revaluation',
    'deep_scan',
    'deep_analysis',
    'kpi_scoring',
    'valuation_support',
    'swot_analysis',
    'missing_info_detection'
  ));
