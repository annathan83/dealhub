-- Add ai_summary_generated to entity_events.event_type CHECK constraint
-- (Workspace tab: user-triggered AI summary saved to Drive summaries/ and logged on timeline)

ALTER TABLE entity_events
  DROP CONSTRAINT IF EXISTS entity_events_event_type_check;

ALTER TABLE entity_events
  ADD CONSTRAINT entity_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'file_uploaded'::text,
    'file_removed'::text,
    'text_extracted'::text,
    'ocr_completed'::text,
    'transcript_completed'::text,
    'facts_extracted'::text,
    'fact_updated'::text,
    'fact_conflict_detected'::text,
    'fact_manually_edited'::text,
    'fact_manually_confirmed'::text,
    'manual_override_applied'::text,
    'analysis_refreshed'::text,
    'revaluation_completed'::text,
    'deep_scan_started'::text,
    'deep_scan_completed'::text,
    'triage_completed'::text,
    'deep_analysis_started'::text,
    'deep_analysis_completed'::text,
    'initial_review_completed'::text,
    'entity_passed'::text,
    'entity_archived'::text,
    'entity_deleted'::text,
    'status_changed'::text,
    'deal_edited'::text,
    'entry_added'::text,
    'ai_summary_generated'::text,
    'nda_detected'::text,
    'nda_marked_signed'::text,
    'nda_status_updated'::text
  ]));
