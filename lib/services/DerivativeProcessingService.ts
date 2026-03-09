/**
 * DerivativeProcessingService
 *
 * State-machine processor for deal_file_derivatives rows.
 * Drives a derivative from 'pending' → 'processing' → 'done' | 'failed'.
 *
 * Architecture:
 *  - Each file type has a dedicated extractor stub.
 *  - Extractors are called synchronously inside the API route for now.
 *  - In Phase 4 these will be moved to background jobs / edge functions.
 *
 * Current extractor status:
 *  - text    → extracts content from deal_sources.content (no AI)
 *  - pdf     → stub (returns null) — Phase 4 will call pdf-parse
 *  - image   → stub (returns null) — Phase 4 will call GPT-4o Vision
 *  - audio   → stub (returns null) — Phase 4 will call Whisper
 *  - spreadsheet → stub (returns null) — Phase 4 will call xlsx
 */

import { updateDerivative, listPendingDerivatives } from "@/lib/db/derivatives";
import { createClient } from "@/lib/supabase/server";
import type { DealFileDerivative, DerivativeFileType } from "@/types";

// ─── Extractor stubs ──────────────────────────────────────────────────────────

type ExtractorResult = {
  extractedText: string | null;
  structuredFields: Record<string, unknown> | null;
  model: string | null;
};

/** Extract text from a pasted note / text entry stored in deal_sources. */
async function extractText(
  derivative: DealFileDerivative
): Promise<ExtractorResult> {
  if (!derivative.deal_source_id) {
    return { extractedText: null, structuredFields: null, model: null };
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("deal_sources")
      .select("content")
      .eq("id", derivative.deal_source_id)
      .maybeSingle();

    return {
      extractedText: (data?.content as string) ?? null,
      structuredFields: null,
      model: "passthrough",
    };
  } catch {
    return { extractedText: null, structuredFields: null, model: null };
  }
}

/** PDF extraction stub — Phase 4 will implement pdf-parse + structured extraction. */
async function extractPdf(
  _derivative: DealFileDerivative
): Promise<ExtractorResult> {
  // TODO Phase 4: download from Drive, run pdf-parse, call GPT-4o-mini for fields
  return { extractedText: null, structuredFields: null, model: null };
}

/** Image extraction stub — Phase 4 will call GPT-4o Vision. */
async function extractImage(
  _derivative: DealFileDerivative
): Promise<ExtractorResult> {
  // TODO Phase 4: download from Drive, call analyzeAttachment with vision model
  return { extractedText: null, structuredFields: null, model: null };
}

/** Audio extraction stub — Phase 4 will call Whisper. */
async function extractAudio(
  _derivative: DealFileDerivative
): Promise<ExtractorResult> {
  // TODO Phase 4: download from Drive, call transcribeAudio, then extract fields
  return { extractedText: null, structuredFields: null, model: null };
}

/** Spreadsheet extraction stub — Phase 4 will call xlsx. */
async function extractSpreadsheet(
  _derivative: DealFileDerivative
): Promise<ExtractorResult> {
  // TODO Phase 4: download from Drive, parse with xlsx, extract financial rows
  return { extractedText: null, structuredFields: null, model: null };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const EXTRACTORS: Record<DerivativeFileType, (d: DealFileDerivative) => Promise<ExtractorResult>> = {
  text: extractText,
  pdf: extractPdf,
  image: extractImage,
  audio: extractAudio,
  spreadsheet: extractSpreadsheet,
  unknown: async () => ({ extractedText: null, structuredFields: null, model: null }),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process a single derivative through the extraction state machine.
 * Transitions: pending → processing → done | failed
 * Returns true if extraction succeeded (even if result was null).
 */
export async function processDerivative(
  derivative: DealFileDerivative
): Promise<boolean> {
  // Mark as processing
  await updateDerivative({
    id: derivative.id,
    userId: derivative.user_id,
    extractionStatus: "processing",
  });

  try {
    const extractor = EXTRACTORS[derivative.file_type] ?? EXTRACTORS.unknown;
    const result = await extractor(derivative);

    await updateDerivative({
      id: derivative.id,
      userId: derivative.user_id,
      extractionStatus: "done",
      extractedText: result.extractedText,
      structuredFields: result.structuredFields,
      extractionModel: result.model,
    });

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DerivativeProcessingService] failed ${derivative.id}:`, message);

    await updateDerivative({
      id: derivative.id,
      userId: derivative.user_id,
      extractionStatus: "failed",
    }).catch(() => {
      // best-effort — don't throw if status update also fails
    });

    return false;
  }
}

/**
 * Process all pending derivatives for a deal.
 * Returns the count of successfully processed derivatives.
 * Safe to call after every upload — already-processed derivatives are skipped.
 */
export async function processPendingDerivatives(
  dealId: string,
  userId: string
): Promise<number> {
  const pending = await listPendingDerivatives(dealId, userId);
  let successCount = 0;

  for (const derivative of pending) {
    const ok = await processDerivative(derivative);
    if (ok) successCount++;
  }

  return successCount;
}
