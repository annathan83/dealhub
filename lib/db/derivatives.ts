// Server-side only — never import from client components
import { createClient } from "@/lib/supabase/server";
import type {
  DealFileDerivative,
  DerivativeFileType,
  DerivativeStatus,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer a broad DerivativeFileType from a MIME type and filename extension.
 * This is a pure classification — no AI involved.
 */
export function inferFileType(mimeType: string, fileName: string): DerivativeFileType {
  const mime = mimeType.toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (mime.startsWith("image/")) return "image";
  if (
    mime.startsWith("audio/") ||
    ["mp3", "m4a", "wav", "webm", "ogg", "aac"].includes(ext)
  ) return "audio";
  if (
    mime === "application/pdf" ||
    ext === "pdf"
  ) return "pdf";
  if (
    ["application/vnd.ms-excel",
     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
     "text/csv"].includes(mime) ||
    ["xls", "xlsx", "csv"].includes(ext)
  ) return "spreadsheet";
  if (
    mime === "text/plain" ||
    mime.startsWith("text/") ||
    ["txt", "md"].includes(ext)
  ) return "text";

  return "unknown";
}

// ─── Insert ───────────────────────────────────────────────────────────────────

export type CreateDerivativeInput = {
  dealId: string;
  userId: string;
  dealSourceId: string | null;
  googleFileId: string | null;
  googleFileName: string | null;
  originalFileName: string;
  mimeType: string | null;
};

/**
 * Insert a new derivative row with status = 'pending'.
 * Called immediately after a file is uploaded or a text entry is saved.
 * Phase 3 will update the row with extracted_text / structured_fields.
 */
export async function createDerivative(
  input: CreateDerivativeInput
): Promise<DealFileDerivative> {
  const supabase = await createClient();

  const fileType = inferFileType(
    input.mimeType ?? "",
    input.originalFileName
  );

  const { data, error } = await supabase
    .from("deal_file_derivatives")
    .insert({
      deal_id: input.dealId,
      user_id: input.userId,
      deal_source_id: input.dealSourceId,
      google_file_id: input.googleFileId,
      google_file_name: input.googleFileName,
      original_file_name: input.originalFileName,
      mime_type: input.mimeType,
      file_type: fileType,
      extraction_status: "pending" satisfies DerivativeStatus,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createDerivative failed: ${error?.message ?? "no data"}`);
  }

  return data as DealFileDerivative;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return all derivatives for a deal, newest first.
 */
export async function listDerivativesForDeal(
  dealId: string,
  userId: string
): Promise<DealFileDerivative[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_file_derivatives")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listDerivativesForDeal error:", error.message);
    return [];
  }

  return (data ?? []) as DealFileDerivative[];
}

/**
 * Return derivatives that are still pending extraction.
 * Used by Phase 3 processing queue.
 */
export async function listPendingDerivatives(
  dealId: string,
  userId: string
): Promise<DealFileDerivative[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_file_derivatives")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .eq("extraction_status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listPendingDerivatives error:", error.message);
    return [];
  }

  return (data ?? []) as DealFileDerivative[];
}

/**
 * Return the derivative linked to a specific deal_source row, if any.
 */
export async function getDerivativeBySourceId(
  dealSourceId: string,
  userId: string
): Promise<DealFileDerivative | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_file_derivatives")
    .select("*")
    .eq("deal_source_id", dealSourceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getDerivativeBySourceId error:", error.message);
    return null;
  }

  return (data as DealFileDerivative) ?? null;
}

// ─── Updates (Phase 3 will use these) ────────────────────────────────────────

export type UpdateDerivativeInput = {
  id: string;
  userId: string;
  extractionStatus: DerivativeStatus;
  extractedText?: string | null;
  structuredFields?: Record<string, unknown> | null;
  extractionModel?: string | null;
  extractionRunId?: string | null;
  confidence?: "high" | "medium" | "low" | null;
};

/**
 * Update a derivative row after Phase 3 extraction completes.
 * Idempotent — safe to call multiple times with the same run_id.
 */
export async function updateDerivative(
  input: UpdateDerivativeInput
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("deal_file_derivatives")
    .update({
      extraction_status: input.extractionStatus,
      extracted_text: input.extractedText ?? null,
      structured_fields: input.structuredFields ?? null,
      extraction_model: input.extractionModel ?? null,
      extraction_run_id: input.extractionRunId ?? null,
      confidence: input.confidence ?? null,
    })
    .eq("id", input.id)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`updateDerivative failed: ${error.message}`);
  }
}
