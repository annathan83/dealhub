// ─── Deal ────────────────────────────────────────────────────────────────────

export type DealStatus = "active" | "closed" | "passed";

/**
 * Intake lifecycle gate — separate from the main deal status.
 * - null / "promoted" → visible normal deal (all existing deals)
 * - "pending"         → deal created, initial scoring in progress
 * - "rejected"        → screened out at intake; hidden from list and stats
 */
export type IntakeStatus = "pending" | "rejected" | "promoted" | null;

export type PassReason =
  | "price_too_high"
  | "financials_dont_work"
  | "wrong_industry"
  | "wrong_location"
  | "owner_dependent"
  | "customer_concentration"
  | "not_enough_info"
  | "other";

// ─── NDA milestone ────────────────────────────────────────────────────────────

/** How the NDA milestone was set */
export type NdaSource = "auto" | "manual" | "override";

/**
 * Derived NDA display state — computed from deal fields, not stored directly.
 * - signed   = nda_signed is true (confident or manually confirmed)
 * - review   = nda_signed is false but confidence exists and is low
 * - pending  = no NDA detected yet
 */
export type NdaState = "signed" | "review" | "pending";

export type Deal = {
  id: string;
  user_id: string;
  deal_number: number;
  /** @deprecated Use display_alias for UI. Kept for backward compat; may store alias or fallback. */
  name: string;
  /** Privacy-safe display name. Use for all UI. Falls back to name then "Deal #N". */
  display_alias: string | null;
  /** @deprecated Do not store confidential or raw document content; raw content stays in Drive. */
  description: string | null;
  // Structured industry (two-level)
  industry_category: string | null;
  industry: string | null;
  // Structured location (three-level)
  state: string | null;
  county: string | null;
  city: string | null;
  /** Legacy single-field location — kept for backward compat, prefer state/county/city */
  location: string | null;
  // Deal source
  deal_source_category: string | null;
  deal_source_detail: string | null;
  status: DealStatus;
  /** Optional broker/primary contact — for search and forms. deal_contacts is source of truth. */
  broker_name: string | null;
  broker_email: string | null;
  broker_phone: string | null;
  asking_price: string | null;
  sde: string | null;
  multiple: string | null;
  google_drive_folder_id: string | null;
  pass_reason: PassReason | null;
  pass_note: string | null;
  passed_at: string | null;
  triaged_at: string | null;
  /** Intake lifecycle gate. null or 'promoted' = normal deal. 'rejected' = screened out. */
  intake_status: IntakeStatus;
  created_at: string;
  updated_at: string;
  /** Last activity timestamp for sorting/filters. */
  last_activity_at: string | null;
  // ── NDA milestone (separate from lifecycle status) ────────────────────────
  nda_signed: boolean;
  nda_signed_at: string | null;
  nda_signed_file_id: string | null;
  nda_signed_confidence: number | null;
  nda_signed_notes: string | null;
  nda_signed_source: NdaSource | null;
};

/** Derive the NDA display state from a deal */
export function getNdaState(deal: Pick<Deal, "nda_signed" | "nda_signed_confidence" | "nda_signed_source">): NdaState {
  if (deal.nda_signed) return "signed";
  // Low-confidence detection = review needed
  if (deal.nda_signed_confidence !== null && deal.nda_signed_confidence < 0.7) return "review";
  return "pending";
}

/**
 * Privacy-safe display name for a deal. Use everywhere in UI instead of deal.name.
 * Prefers display_alias, then name, then "Deal #N" (or "Deal" if deal_number missing).
 */
export function getDealDisplayName(deal: { display_alias?: string | null; name?: string | null; deal_number?: number }): string {
  const alias = deal.display_alias?.trim();
  if (alias) return alias;
  const name = deal.name?.trim();
  if (name) return name;
  if (typeof deal.deal_number === "number") return `Deal #${deal.deal_number}`;
  return "Deal";
}

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

