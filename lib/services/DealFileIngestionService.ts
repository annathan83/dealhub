/**
 * DealFileIngestionService
 *
 * Orchestrates the creation of a deal_files record + a deal_file_derivatives
 * placeholder immediately after a file is uploaded or a text entry is saved.
 *
 * Responsibilities:
 *  - Create a deal_files row (provider-agnostic canonical record)
 *  - Create a deal_file_derivatives row with status = 'pending'
 *  - Return both records to the caller
 *
 * This service is intentionally thin — it does NOT call AI or extract text.
 * DerivativeProcessingService handles the extraction step.
 */

import { createDealFile, type CreateDealFileInput } from "@/lib/db/dealFiles";
import { createDerivative } from "@/lib/db/derivatives";
import type { DealFile, DealFileDerivative, FileSourceKind } from "@/types";

export type IngestFileInput = {
  dealId: string;
  userId: string;
  originalFileName: string;
  mimeType: string | null;
  sourceKind?: FileSourceKind;
  // Google Drive provider fields (optional — omit for non-Drive uploads)
  googleFileId?: string | null;
  googleFileName?: string | null;
  webViewLink?: string | null;
  sizeBytes?: number | null;
  // Link to the deal_sources row created for this upload (optional)
  dealSourceId?: string | null;
};

export type IngestFileResult = {
  dealFile: DealFile;
  derivative: DealFileDerivative;
};

/**
 * Register a newly uploaded file in both deal_files and deal_file_derivatives.
 * Safe to call from any API route after a successful upload.
 * Errors are thrown — callers should wrap in try/catch and treat as non-fatal
 * if the upload itself already succeeded.
 */
export async function ingestFile(input: IngestFileInput): Promise<IngestFileResult> {
  // 1. Create the canonical deal_files record
  const fileInput: CreateDealFileInput = {
    deal_id: input.dealId,
    user_id: input.userId,
    original_file_name: input.originalFileName,
    mime_type: input.mimeType,
    storage_provider: "google_drive",
    provider_file_id: input.googleFileId ?? null,
    provider_file_name: input.googleFileName ?? null,
    web_view_link: input.webViewLink ?? null,
    size_bytes: input.sizeBytes ?? null,
    source_kind: input.sourceKind ?? "uploaded_file",
    ingest_status: "uploaded",
  };

  const dealFile = await createDealFile(fileInput);

  // 2. Create the derivative placeholder linked to the new deal_files row
  const derivative = await createDerivative({
    dealId: input.dealId,
    userId: input.userId,
    dealSourceId: input.dealSourceId ?? null,
    googleFileId: input.googleFileId ?? null,
    googleFileName: input.googleFileName ?? null,
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    dealFileId: dealFile.id,
  });

  return { dealFile, derivative };
}

/**
 * Lightweight variant for pasted text entries — no provider file ID.
 * Creates a deal_files record with source_kind = 'pasted_text' and
 * a derivative with file_type = 'text'.
 */
export async function ingestTextEntry(opts: {
  dealId: string;
  userId: string;
  dealSourceId: string;
  contentPreview?: string;
}): Promise<IngestFileResult> {
  return ingestFile({
    dealId: opts.dealId,
    userId: opts.userId,
    originalFileName: `entry-${opts.dealSourceId}.txt`,
    mimeType: "text/plain",
    sourceKind: "pasted_text",
    dealSourceId: opts.dealSourceId,
  });
}
