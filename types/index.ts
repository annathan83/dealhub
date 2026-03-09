// ─── Deal ────────────────────────────────────────────────────────────────────

export type DealStatus =
  | "new"
  | "reviewing"
  | "due_diligence"
  | "offer"
  | "closed"
  | "passed";

export type Deal = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  status: DealStatus;
  asking_price: string | null;
  sde: string | null;
  multiple: string | null;
  google_drive_folder_id: string | null;
  created_at: string;
};

// ─── Deal Source ──────────────────────────────────────────────────────────────

// source_type and title are system/AI-generated — never provided by the user
export type SourceType =
  | "note"
  | "listing"
  | "broker_email"
  | "financial_summary"
  | "file"
  | "unknown";

export type DealSource = {
  id: string;
  deal_id: string;
  user_id: string;
  source_type: SourceType | null;
  title: string | null;
  content: string;
  created_at: string;
};

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export type ExtractedFacts = {
  business_name: string | null;
  asking_price: string | null;
  revenue: string | null;
  sde: string | null;
  ebitda: string | null;
  industry: string | null;
  location: string | null;
  employees: string | null;
  rent: string | null;
  lease_term: string | null;
  ff_and_e: string | null;
  inventory: string | null;
  growth_claims: string[];
  other_key_facts: string[];
};

export type DealSourceAnalysis = {
  id: string;
  deal_source_id: string;
  deal_id: string;
  user_id: string;
  generated_title: string | null;
  detected_type: SourceType | null;
  summary: string | null;
  extracted_facts: ExtractedFacts;
  red_flags: string[];
  missing_information: string[];
  broker_questions: string[];
  created_at: string;
};

// ─── Change Log ───────────────────────────────────────────────────────────────

export type ChangeLogItemType =
  | "new_fact"
  | "updated_fact"
  | "concern"
  | "follow_up"
  | "file_uploaded"
  | "deal_edited";

export type DealChangeLogItem = {
  id: string;
  deal_id: string;
  deal_source_id: string | null;
  user_id: string;
  change_type: ChangeLogItemType;
  title: string;
  description: string;
  // optional — present on file_uploaded items
  related_google_file_id?: string | null;
  created_at: string;
};

// ─── Google Drive ─────────────────────────────────────────────────────────────

export type GoogleDriveConnection = {
  id: string;
  user_id: string;
  google_email: string | null;
  root_folder_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DealDriveFile = {
  id: string;
  user_id: string;
  deal_id: string;
  google_file_id: string;
  google_file_name: string;
  original_file_name: string | null;
  mime_type: string | null;
  web_view_link: string | null;
  created_time: string | null;
  source_kind: string;
  created_at: string;
};

// ─── File Analysis ────────────────────────────────────────────────────────────

export type AttachmentKind =
  | "pnl"
  | "tax_return"
  | "balance_sheet"
  | "lease"
  | "broker_listing"
  | "broker_email_export"
  | "payroll"
  | "bank_statement"
  | "marketing_material"
  | "spreadsheet"
  | "image"
  | "document"
  | "unknown";

export type AttachmentConfidence = "high" | "medium" | "low";

export type FileAnalysis = {
  id: string;
  user_id: string;
  deal_id: string;
  google_file_id: string;
  google_file_name: string;
  mime_type: string | null;
  detected_kind: AttachmentKind | null;
  generated_title: string | null;
  summary: string | null;
  confidence: AttachmentConfidence | null;
  extracted_signals: {
    extension?: string;
    mime_type?: string;
    keywords?: string[];
  };
  created_at: string;
};

export type AttachmentAnalysisResult = {
  detected_kind: AttachmentKind;
  generated_title: string;
  summary: string;
  confidence: AttachmentConfidence;
  extracted_signals: {
    extension: string;
    mime_type: string;
    keywords: string[];
  };
  change_log_item: {
    change_type: "file_uploaded";
    title: string;
    description: string;
  };
};

// ─── Incremental AI pipeline ──────────────────────────────────────────────────

/** Extraction status of a single file derivative */
export type DerivativeStatus = "pending" | "processing" | "done" | "failed";

/** Broad category used to route extraction logic */
export type DerivativeFileType =
  | "pdf"
  | "image"
  | "audio"
  | "text"
  | "spreadsheet"
  | "unknown";

/**
 * One row per uploaded file or pasted entry.
 * Stores the extracted text / structured fields so the file is
 * processed by AI exactly once (Phase 3 populates extracted_text
 * and structured_fields; Phase 1/2 inserts with status = 'pending').
 */
export type DealFileDerivative = {
  id: string;
  deal_id: string;
  user_id: string;
  deal_source_id: string | null;
  google_file_id: string | null;
  google_file_name: string | null;
  original_file_name: string;
  mime_type: string | null;
  file_type: DerivativeFileType;
  extraction_status: DerivativeStatus;
  extracted_text: string | null;       // populated in Phase 3
  structured_fields: DealStructuredFields | null; // populated in Phase 3
  extraction_model: string | null;
  extraction_run_id: string | null;
  confidence: AttachmentConfidence | null;
  created_at: string;
  updated_at: string;
};

/**
 * Structured financial/operational fields extracted from a file.
 * Mirrors ExtractedFacts but is stored on the derivative, not the analysis.
 */
export type DealStructuredFields = {
  asking_price: string | null;
  revenue: string | null;
  sde: string | null;
  ebitda: string | null;
  rent_monthly: string | null;
  headcount: string | null;
  capacity: string | null;
  enrollment: string | null;
  seller_role: string | null;
  lease_expiry: string | null;
  risks: string[];
  missing_information: string[];
  other_facts: string[];
};

/** Verdict label produced by deal-level AI analysis */
export type AIDealVerdict =
  | "Strong Buy"
  | "Proceed with Caution"
  | "Needs More Info"
  | "Pass";

/**
 * One row per deal-level analysis run.
 * The latest row for a deal_id is the current intelligence state.
 * Phase 3 populates all AI fields; Phase 1/2 the table exists but stays empty.
 */
export type DealInsight = {
  id: string;
  deal_id: string;
  user_id: string;
  run_id: string;
  ai_deal_score: number | null;         // 0–100
  ai_verdict: AIDealVerdict | null;
  verdict_reasoning: string | null;
  risk_flags: DealRiskFlag[];
  missing_information: string[];
  broker_questions: string[];
  running_summary: string | null;
  valuation_context: DealValuationContext | null;
  source_derivative_ids: string[];
  created_at: string;
};

export type DealRiskFlag = {
  flag: string;
  severity: "high" | "medium" | "low";
  source_derivative_id: string | null;
};

export type DealValuationContext = {
  implied_multiple: string | null;
  revenue_multiple: string | null;
  sde_multiple: string | null;
  notes: string | null;
};

// ─── Phase 3: provider-agnostic file registry ────────────────────────────────

export type FileIngestStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "processed"
  | "failed";

export type FileStorageProvider = "google_drive" | "s3" | "local" | "supabase_storage";

export type FileSourceKind =
  | "uploaded_file"
  | "webcam_photo"
  | "audio_recording"
  | "pasted_text"
  | "ai_assessment"
  | "manual";

/** Canonical file record (deal_files table). Supersedes DealDriveFile for new code. */
export type DealFile = {
  id: string;
  deal_id: string;
  user_id: string;
  storage_provider: FileStorageProvider;
  provider_file_id: string | null;
  provider_file_name: string | null;
  web_view_link: string | null;
  original_file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  source_kind: FileSourceKind;
  uploaded_by: string | null;
  uploaded_at: string;
  ingest_status: FileIngestStatus;
  legacy_drive_file_id: string | null;
  created_at: string;
};

// ─── Phase 3: analysis run versioning ────────────────────────────────────────

export type AnalysisRunType = "file_extraction" | "deal_aggregation";
export type AnalysisRunStatus = "pending" | "running" | "completed" | "failed";
export type AnalysisRunTrigger = "upload" | "entry" | "manual" | "system" | "backfill";

export type DealAnalysisRun = {
  id: string;
  deal_id: string;
  user_id: string;
  run_type: AnalysisRunType;
  triggered_by: AnalysisRunTrigger;
  status: AnalysisRunStatus;
  started_at: string;
  completed_at: string | null;
  model_name: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  notes: string | null;
  error_message: string | null;
  source_file_ids: string[];
  derivative_ids: string[];
  created_at: string;
};

// ─── Phase 3: source claims ───────────────────────────────────────────────────

export type DealSourceClaim = {
  id: string;
  deal_id: string;
  user_id: string;
  analysis_run_id: string | null;
  source_file_id: string | null;
  source_derivative_id: string | null;
  source_deal_source_id: string | null;
  field_name: string;
  raw_value: string | null;
  numeric_value: number | null;
  text_value: string | null;
  unit: string | null;
  confidence: number | null;
  extraction_model: string | null;
  extraction_run_id: string | null;
  superseded_by: string | null;
  is_active: boolean;
  extracted_at: string;
  created_at: string;
};

// ─── Phase 3: metric snapshots ────────────────────────────────────────────────

export type DealMetricSnapshot = {
  id: string;
  deal_id: string;
  user_id: string;
  analysis_run_id: string;
  asking_price: number | null;
  revenue: number | null;
  sde: number | null;
  ebitda: number | null;
  gross_profit: number | null;
  net_income: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  implied_multiple: number | null;
  revenue_multiple: number | null;
  sde_multiple: number | null;
  employee_count: number | null;
  year_established: number | null;
  years_in_business: number | null;
  currency: string;
  snapshot_notes: string | null;
  source_claim_ids: string[];
  created_at: string;
};

// ─── Phase 3: deal opinions (supersedes DealInsight for new runs) ─────────────

export type DealOpinion = {
  id: string;
  deal_id: string;
  user_id: string;
  analysis_run_id: string;
  metric_snapshot_id: string | null;
  ai_deal_score: number | null;
  ai_verdict: AIDealVerdict | null;
  risk_flags: DealRiskFlag[];
  missing_information: string[];
  broker_questions: string[];
  running_summary: string | null;
  valuation_context: DealValuationContext | null;
  model_name: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  derivative_ids_used: string[];
  created_at: string;
};

// ─── Phase 3: opinion deltas ──────────────────────────────────────────────────

export type MetricChange = {
  before: number | null;
  after: number | null;
};

export type DealOpinionDelta = {
  id: string;
  deal_id: string;
  user_id: string;
  from_opinion_id: string | null;
  to_opinion_id: string;
  score_before: number | null;
  score_after: number | null;
  score_change: number | null;
  verdict_before: AIDealVerdict | null;
  verdict_after: AIDealVerdict | null;
  verdict_changed: boolean;
  changed_metrics: Record<string, MetricChange>;
  added_risks: DealRiskFlag[];
  removed_risks: DealRiskFlag[];
  resolved_missing: string[];
  new_missing: string[];
  triggering_file_ids: string[];
  created_at: string;
};

// ─── Phase 3: extended Deal type ─────────────────────────────────────────────

/** Extends the base Deal with Phase 3 pointer columns */
export type DealWithIntelligence = Deal & {
  last_analysis_run_id: string | null;
  current_opinion_id: string | null;
};

// ─── AI helper return type ────────────────────────────────────────────────────

export type AnalysisResult = {
  generated_title: string;
  detected_type: SourceType;
  summary: string;
  extracted_facts: ExtractedFacts;
  red_flags: string[];
  missing_information: string[];
  broker_questions: string[];
  change_log_items: {
    change_type: ChangeLogItemType;
    title: string;
    description: string;
  }[];
};
