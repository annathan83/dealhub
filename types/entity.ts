// ─── Entity Types ─────────────────────────────────────────────────────────────

export type EntityTypeKey = "deal" | "property" | "case" | "project";

export type EntityType = {
  id: string;
  key: EntityTypeKey;
  label: string;
  description: string | null;
  created_at: string;
};

export type Entity = {
  id: string;
  entity_type_id: string;
  legacy_deal_id: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  owner_user_id: string | null;
  workspace_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;

  // ── Denormalized summary fields (kept for fast UI reads) ──
  // Source: updated atomically by the deep analysis pipeline.
  // Source of truth for run history: processing_runs table.
  deep_analysis_run_at: string | null;
  deep_analysis_stale: boolean;
  latest_source_at: string | null;

  // ── Incremental revaluation tracking (migration 034) ──
  // Separate from deep_analysis_* which tracks the full deep scan.
  last_revaluation_at: string | null;
  revaluation_stale: boolean;
};

// ─── File Layer ───────────────────────────────────────────────────────────────

export type EntityFile = {
  id: string;
  entity_id: string;
  legacy_deal_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  source_type: string | null;
  document_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  metadata_json: Record<string, unknown>;
  // Drive / display metadata (added migration 025)
  web_view_link: string | null;
  drive_created_time: string | null;
  title: string | null;
  summary: string | null;
};

export type FileExtractionStatus = "pending" | "done" | "failed" | "skipped";

/**
 * Text type distinguishes multiple text representations per file.
 * Migration 026 added text_type to file_texts (renamed from file_text).
 */
export type FileTextType =
  | "raw_extracted"    // first-pass extraction (PDF, mammoth, xlsx, passthrough)
  | "transcript"       // Whisper audio transcript
  | "ocr"              // Vision / OCR result
  | "normalized"       // cleaned/normalized for AI consumption
  | "translated"       // translated to English
  | "cleaned_for_ai";  // further cleaned/truncated for prompt use

export type FileText = {
  id: string;
  file_id: string;
  /** Which text representation this record holds. Default: 'raw_extracted'. */
  text_type: FileTextType;
  full_text: string | null;
  language: string | null;
  extraction_method: string | null;
  extraction_status: FileExtractionStatus;
  extracted_at: string | null;
  metadata_json: Record<string, unknown>;
};

export type FileChunk = {
  id: string;
  file_id: string;
  /** FK to the specific file_texts record that produced this chunk set. */
  file_text_id: string | null;
  chunk_index: number;
  text: string;
  page_number: number | null;
  token_count: number | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

// ─── Fact Definitions ─────────────────────────────────────────────────────────

export type FactCategory = "financial" | "deal_terms" | "operations" | "people" | "real_estate";
export type FactDataType = "currency" | "number" | "percent" | "text" | "boolean" | "date";

/**
 * Which workflow stage this fact belongs to.
 * - 'triage'    → shown in initial review (the fixed triage set)
 * - 'deep'      → surfaced during deep analysis / full fact library
 * - 'universal' → always relevant regardless of stage
 */
export type FactScope = "triage" | "deep" | "universal";

export type FactDefinition = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: FactCategory | null;
  data_type: FactDataType;
  is_critical: boolean;
  is_multi_value: boolean;
  /** Stage this fact belongs to. Used to filter the triage vs. full fact library. */
  fact_scope: FactScope;
  /** Top-level display ordering within a category. */
  display_order: number | null;
  /** Whether to show in the initial triage UI (first-screen experience). */
  is_user_visible_initially: boolean;
  /** Whether this fact feeds the KPI scorecard. */
  is_required_for_kpi: boolean;
  /** Optional industry overlay key (e.g. 'saas', 'restaurant'). Null = all industries. */
  industry_key: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type FactDefinitionEntityType = {
  id: string;
  fact_definition_id: string;
  entity_type_id: string;
  is_required: boolean;
  display_order: number | null;
};

// ─── Fact Evidence ────────────────────────────────────────────────────────────

export type EvidenceStatus = "candidate" | "accepted" | "rejected";

/**
 * What kind of extraction produced this evidence.
 */
export type EvidenceType =
  | "ai_extraction"
  | "user_input"
  | "ocr_extraction"
  | "transcript_extraction"
  | "import"
  | "system_derived";

export type FactEvidence = {
  id: string;
  entity_id: string;
  fact_definition_id: string;
  file_id: string;
  file_chunk_id: string | null;
  extracted_value_raw: string | null;
  normalized_value_json: Record<string, unknown>;
  snippet: string | null;
  page_number: number | null;
  confidence: number | null;
  extractor_version: string | null;
  evidence_status: EvidenceStatus;
  /** What kind of extraction produced this evidence. */
  evidence_type: EvidenceType;
  /** True if this is the current best evidence for this fact. */
  is_primary: boolean;
  /** Ordinal rank (1 = best) for ordering multiple evidence rows. */
  evidence_rank: number | null;
  is_superseded: boolean;
  /** When this evidence was superseded (for audit trail). */
  superseded_at: string | null;
  is_conflicting: boolean;
  created_at: string;
};

// ─── Entity Fact Values ───────────────────────────────────────────────────────

export type FactValueStatus = "confirmed" | "unclear" | "missing" | "conflicting" | "estimated";

/**
 * Who/what produced the current fact value.
 */
export type ValueSourceType =
  | "ai_extracted"
  | "user_override"
  | "broker_confirmed"
  | "imported"
  | "system_derived";

/**
 * Human-in-the-loop review state for a fact value.
 */
export type ReviewStatus = "unreviewed" | "confirmed" | "edited" | "rejected";

export type EntityFactValue = {
  id: string;
  entity_id: string;
  fact_definition_id: string;
  value_raw: string | null;
  value_normalized_json: Record<string, unknown>;
  status: FactValueStatus;
  confidence: number | null;
  current_evidence_id: string | null;

  // ── Richer source/review lifecycle (migration 026) ──
  /** Who/what produced the current value. */
  value_source_type: ValueSourceType;
  /** Human review state. */
  review_status: ReviewStatus;
  /** User who confirmed/edited this value. */
  confirmed_by_user_id: string | null;
  confirmed_at: string | null;
  /** Optional reason for the last change (for audit trail). */
  change_reason: string | null;

  updated_at: string;
};

// ─── Fact Edit Log ────────────────────────────────────────────────────────────

export type FactChangeType = "confirm" | "edit" | "override" | "mark_conflict" | "mark_missing";

export type FactEditLogEntry = {
  id: string;
  entity_id: string;
  fact_definition_id: string;
  changed_by: string;
  change_type: FactChangeType;
  old_value: string | null;
  new_value: string | null;
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  created_at: string;
};

// ─── Processing Runs ──────────────────────────────────────────────────────────

/**
 * What kind of system operation this run represents.
 */
export type ProcessingRunType =
  | "text_extraction"
  | "ocr"
  | "transcription"
  | "fact_extraction"
  | "triage_generation"
  | "incremental_revaluation"
  | "deep_scan"
  | "deep_analysis"
  | "kpi_scoring"
  | "valuation_support";

export type ProcessingRunStatus = "queued" | "running" | "completed" | "failed" | "skipped";

export type ProcessingRunTrigger = "system" | "user" | "re_run" | "upload_event";

export type ProcessingRun = {
  id: string;
  entity_id: string;
  run_type: ProcessingRunType;
  status: ProcessingRunStatus;
  triggered_by_type: ProcessingRunTrigger;
  triggered_by_user_id: string | null;
  model_name: string | null;
  model_version: string | null;
  prompt_version: string | null;
  /** Hash of input content — used for dedup and change detection. */
  input_hash: string | null;
  related_file_id: string | null;
  related_text_id: string | null;
  /** Lightweight summary of run output (full output in analysis_snapshots). */
  output_summary_json: Record<string, unknown>;
  error_message: string | null;
  error_details_json: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

// ─── Analysis Snapshots ───────────────────────────────────────────────────────

export type AnalysisType =
  | "deal_assessment"
  | "valuation"
  | "risk_flags"
  | "questions"
  | "kpi_scorecard"
  | "triage_summary"
  | "deep_analysis"
  | "revaluation";

export type AnalysisSnapshot = {
  id: string;
  entity_id: string;
  analysis_type: AnalysisType;
  title: string | null;
  content_json: Record<string, unknown>;
  model_name: string | null;
  prompt_version: string | null;
  /** FK to the processing_run that produced this snapshot. */
  run_id: string | null;
  created_at: string;
};

// ─── Entity Events ────────────────────────────────────────────────────────────

export type EntityEventType =
  // File lifecycle
  | "file_uploaded"
  | "file_removed"
  // Text extraction
  | "text_extracted"
  | "ocr_completed"
  | "transcript_completed"
  // Fact lifecycle
  | "facts_extracted"
  | "fact_updated"
  | "fact_conflict_detected"
  | "fact_manually_edited"
  | "fact_manually_confirmed"
  | "manual_override_applied"
  // Analysis lifecycle
  | "analysis_refreshed"
  | "revaluation_completed"
  | "deep_scan_started"
  | "deep_scan_completed"
  | "triage_completed"
  | "deep_analysis_started"
  | "deep_analysis_completed"
  | "initial_review_completed"
  // Entity lifecycle
  | "entity_passed"
  | "entity_archived"
  | "entity_deleted"
  | "status_changed"
  // Legacy / compat
  | "deal_edited"
  | "entry_added";

export type EntityEvent = {
  id: string;
  entity_id: string;
  event_type: EntityEventType;
  file_id: string | null;
  fact_definition_id: string | null;
  /** FK to the processing_run that generated this event. */
  run_id: string | null;
  /** User who triggered the action (for human-initiated events). */
  actor_user_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

// ─── AI Memories ─────────────────────────────────────────────────────────────

/**
 * Durable contextual observations extracted from source material.
 * Separate from structured facts (normalized/typed) and analysis_snapshots (AI narrative blobs).
 * Examples: "seller seems open to financing", "employee retention risk mentioned".
 */
export type AiMemoryType = "risk" | "opportunity" | "context" | "flag" | "question";
export type AiMemoryImportance = "high" | "medium" | "low";
export type AiMemoryStatus = "active" | "superseded" | "dismissed";

export type AiMemory = {
  id: string;
  entity_id: string;
  memory_type: AiMemoryType;
  memory_text: string;
  importance: AiMemoryImportance;
  confidence: number | null;
  source_file_id: string | null;
  source_excerpt: string | null;
  status: AiMemoryStatus;
  superseded_by: string | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Fact History ─────────────────────────────────────────────────────────────

/**
 * Structured diff log covering both AI-driven fact changes and user overrides.
 * Complements entity_events (timeline) and fact_edit_log (manual edits only).
 */
export type FactHistoryRecordType = "structured_fact" | "ai_memory";
export type FactHistoryAction =
  | "created"
  | "updated"
  | "superseded"
  | "overridden"
  | "dismissed"
  | "confirmed"
  | "deleted";

export type FactHistoryEntry = {
  id: string;
  entity_id: string;
  record_type: FactHistoryRecordType;
  record_id: string;
  action: FactHistoryAction;
  old_value_json: Record<string, unknown> | null;
  new_value_json: Record<string, unknown> | null;
  reason: string | null;
  source_file_id: string | null;
  run_id: string | null;
  created_at: string;
  created_by: string;
};

// ─── Composite / View types ───────────────────────────────────────────────────

/** FactDefinition enriched with the current entity_fact_value for a specific entity */
export type FactWithValue = FactDefinition & {
  current_value: EntityFactValue | null;
  evidence_count: number;
};

/** EntityFile enriched with its extracted text records and chunk count */
export type EntityFileWithText = EntityFile & {
  /** Primary / raw_extracted text record (backward compat). */
  file_text: FileText | null;
  chunk_count: number;
  /** All text records for this file (multi-version). */
  all_texts?: FileText[];
};

/** Full entity page data */
export type EntityPageData = {
  entity: Entity;
  entity_type: EntityType;
  files: EntityFileWithText[];
  fact_values: EntityFactValue[];
  fact_definitions: FactDefinition[];
  fact_evidence: FactEvidence[];
  analysis_snapshots: AnalysisSnapshot[];
  events: EntityEvent[];
  ai_memories?: AiMemory[];
};
