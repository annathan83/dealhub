-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021: Triage-First Deal Flow
--
-- 1. Expand deal status enum values (drop + recreate constraint)
-- 2. Add triage/pass fields to deals table
-- 3. Extend entity_events to support triage_completed event
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Expand deal status values ─────────────────────────────────────────────
-- The deals.status column is a plain text column with a check constraint.
-- We replace the constraint to include the new triage lifecycle values.

alter table deals
  drop constraint if exists deals_status_check;

alter table deals
  add constraint deals_status_check
  check (status in (
    'new',
    'triaged',
    'investigating',
    'passed',
    'loi',
    'acquired',
    'archived',
    -- legacy values kept for backwards compatibility during transition
    'reviewing',
    'due_diligence',
    'offer',
    'closed'
  ));

-- ── 2. Add triage / pass tracking columns to deals ───────────────────────────

alter table deals
  add column if not exists pass_reason  text,
  add column if not exists pass_note    text,
  add column if not exists passed_at    timestamptz,
  add column if not exists triaged_at   timestamptz;

-- ── 3. Extend entity_events event_type check ─────────────────────────────────
-- Add triage_completed to the allowed event types.

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
    'triage_completed'
  ));
