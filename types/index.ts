// ─── Deal ────────────────────────────────────────────────────────────────────

export type DealStatus =
  // New triage lifecycle
  | "new"
  | "triaged"
  | "investigating"
  | "passed"
  | "loi"
  | "acquired"
  | "archived"
  // Legacy statuses (kept for backwards compatibility)
  | "reviewing"
  | "due_diligence"
  | "offer"
  | "closed";

export type PassReason =
  | "price_too_high"
  | "financials_dont_work"
  | "wrong_industry"
  | "wrong_location"
  | "owner_dependent"
  | "customer_concentration"
  | "not_enough_info"
  | "other";

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
  pass_reason: PassReason | null;
  pass_note: string | null;
  passed_at: string | null;
  triaged_at: string | null;
  created_at: string;
  updated_at: string;
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

