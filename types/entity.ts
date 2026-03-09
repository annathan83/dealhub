// ─── Entity Types ─────────────────────────────────────────────────────────────

export type EntityTypeKey = "deal" | "property" | "case" | "project";

export type EntityType = {
  id: string;
  key: EntityTypeKey;
  label: string;
  description: string | null;
  created_at: string;
};

export type DeepScanStatus = "not_run" | "running" | "completed" | "failed";

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
  deep_scan_status: DeepScanStatus | null;
  deep_scan_started_at: string | null;
  deep_scan_completed_at: string | null;
  deep_scan_facts_added: number | null;
  deep_scan_facts_updated: number | null;
  deep_scan_conflicts_found: number | null;
  deep_analysis_run_at: string | null;
  deep_analysis_stale: boolean;
  latest_source_at: string | null;
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
  web_view_link: string | null;
  drive_created_time: string | null;
  title: string | null;
  summary: string | null;
};

export type FileExtractionStatus = "pending" | "done" | "failed" | "skipped";

export type FileText = {
  id: string;
  file_id: string;
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

export type FactDefinition = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: FactCategory | null;
  data_type: FactDataType;
  is_critical: boolean;
  is_multi_value: boolean;
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
  is_superseded: boolean;
  is_conflicting: boolean;
  created_at: string;
};

// ─── Entity Fact Values ───────────────────────────────────────────────────────

export type FactValueStatus = "confirmed" | "unclear" | "missing" | "conflicting" | "estimated";

export type EntityFactValue = {
  id: string;
  entity_id: string;
  fact_definition_id: string;
  value_raw: string | null;
  value_normalized_json: Record<string, unknown>;
  status: FactValueStatus;
  confidence: number | null;
  current_evidence_id: string | null;
  manual_override: boolean;
  override_note: string | null;
  override_by: string | null;
  override_at: string | null;
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

// ─── Analysis Snapshots ───────────────────────────────────────────────────────

export type AnalysisType = "deal_assessment" | "valuation" | "risk_flags" | "questions" | "kpi_scorecard" | "triage_summary" | "deep_analysis";

export type AnalysisSnapshot = {
  id: string;
  entity_id: string;
  analysis_type: AnalysisType;
  title: string | null;
  content_json: Record<string, unknown>;
  model_name: string | null;
  prompt_version: string | null;
  created_at: string;
};

// ─── Entity Events ────────────────────────────────────────────────────────────

export type EntityEventType =
  | "file_uploaded"
  | "text_extracted"
  | "facts_extracted"
  | "fact_updated"
  | "fact_conflict_detected"
  | "analysis_refreshed"
  | "fact_manually_edited"
  | "fact_manually_confirmed"
  | "deep_scan_started"
  | "deep_scan_completed"
  | "triage_completed"
  | "deep_analysis_started"
  | "deep_analysis_completed"
  | "deal_edited"
  | "entry_added";

export type EntityEvent = {
  id: string;
  entity_id: string;
  event_type: EntityEventType;
  file_id: string | null;
  fact_definition_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

// ─── Composite / View types ───────────────────────────────────────────────────

/** FactDefinition enriched with the current entity_fact_value for a specific entity */
export type FactWithValue = FactDefinition & {
  current_value: EntityFactValue | null;
  evidence_count: number;
};

/** EntityFile enriched with its extracted text and chunk count */
export type EntityFileWithText = EntityFile & {
  file_text: FileText | null;
  chunk_count: number;
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
};
