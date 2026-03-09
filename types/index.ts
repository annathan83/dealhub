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
  deal_number: number;
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
  updated_at: string;
};

// ─── Deal Source (timeline entries) ──────────────────────────────────────────

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

// ─── Per-entry AI analysis (deal_source_analyses) ────────────────────────────
// Kept for the timeline display. Facts are now stored in entity_fact_values.

export type DealSourceAnalysis = {
  id: string;
  deal_source_id: string;
  deal_id: string;
  user_id: string;
  generated_title: string | null;
  detected_type: SourceType | null;
  summary: string | null;
  extracted_facts: Record<string, unknown>;
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

// ─── File attachment AI analysis (used by analyzeAttachment.ts) ───────────────

export type AttachmentKind =
  | "pnl" | "tax_return" | "balance_sheet" | "lease" | "broker_listing"
  | "broker_email_export" | "payroll" | "bank_statement" | "marketing_material"
  | "spreadsheet" | "image" | "document" | "unknown";

export type AttachmentConfidence = "high" | "medium" | "low";

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

// ─── AI helper return type (used by analyzeDealEntry.ts) ─────────────────────

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
