/**
 * DerivativeProcessingService
 *
 * State-machine processor for deal_file_derivatives rows.
 * Drives a derivative from 'pending' → 'processing' → 'done' | 'failed'.
 *
 * Extractor status:
 *  - text        → reads deal_sources.content directly (no AI, no Drive)
 *  - image       → downloads from Drive, calls GPT-4o Vision
 *  - audio       → downloads from Drive, calls Whisper transcription
 *  - pdf         → downloads from Drive, extracts text with pdf-parse
 *  - spreadsheet → downloads from Drive, extracts CSV rows with xlsx
 */

import { updateDerivative, listPendingDerivatives } from "@/lib/db/derivatives";
import { createClient } from "@/lib/supabase/server";
import { downloadDriveFile } from "@/lib/google/drive";
import { analyzeImageAttachment } from "@/lib/ai/analyzeAttachment";
import { transcribeAudio } from "@/lib/ai/transcribeAudio";
import { extractTextFromBuffer } from "@/lib/files/extractText";
import { analyzePdfAttachment } from "@/lib/ai/analyzeAttachment";
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

/** Download PDF from Drive and extract text. Falls back to Vision for scanned PDFs. */
async function extractPdf(
  derivative: DealFileDerivative
): Promise<ExtractorResult> {
  if (!derivative.google_file_id) {
    return { extractedText: null, structuredFields: null, model: null };
  }

  const buffer = await downloadDriveFile(derivative.user_id, derivative.google_file_id);
  // extractTextFromBuffer never throws — returns a diagnostic note on failure
  const text = await extractTextFromBuffer(buffer, derivative.original_file_name);
  const isNote = text.startsWith("[Text extraction note:");
  const isScanned = isNote && text.includes("scanned");

  if (isScanned) {
    // Scanned/image-only PDF — send to the Responses API for visual analysis
    try {
      const result = await analyzePdfAttachment({
        dealName: "",
        originalFileName: derivative.original_file_name,
        pdfBuffer: buffer,
      });
      const summary = result.summary;
      return {
        extractedText: summary,
        structuredFields: {
          detected_kind: result.detected_kind,
          generated_title: result.generated_title,
          confidence: result.confidence,
          keywords: result.extracted_signals.keywords,
          scanned_pdf: true,
        },
        model: "gpt-4o-mini-responses",
      };
    } catch (err) {
      console.error("[extractPdf] Responses API fallback failed:", err);
      return { extractedText: text, structuredFields: { extraction_note: text }, model: null };
    }
  }

  return {
    extractedText: isNote ? null : text,
    structuredFields: {
      char_count: isNote ? 0 : text.length,
      word_count: isNote ? 0 : text.split(/\s+/).filter(Boolean).length,
      extraction_note: isNote ? text : null,
    },
    model: "pdf-parse",
  };
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;  // 4 MB — GPT-4o Vision limit
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — Whisper limit

/**
 * Download image from Drive and run GPT-4o Vision analysis.
 * Stores the AI summary as extracted_text and key signals as structured_fields.
 */
async function extractImage(
  derivative: DealFileDerivative
): Promise<ExtractorResult> {
  if (!derivative.google_file_id) {
    return { extractedText: null, structuredFields: null, model: null };
  }

  const buffer = await downloadDriveFile(derivative.user_id, derivative.google_file_id);

  if (buffer.length > MAX_IMAGE_BYTES) {
    return {
      extractedText: `Image too large for Vision API (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 4 MB limit).`,
      structuredFields: null,
      model: null,
    };
  }

  const mimeType = derivative.mime_type ?? "image/jpeg";
  const imageBase64 = buffer.toString("base64");

  const result = await analyzeImageAttachment({
    dealName: "",
    driveFileName: derivative.google_file_name ?? derivative.original_file_name,
    originalFileName: derivative.original_file_name,
    mimeType,
    imageBase64,
  });

  return {
    extractedText: result.summary,
    structuredFields: {
      detected_kind: result.detected_kind,
      generated_title: result.generated_title,
      confidence: result.confidence,
      keywords: result.extracted_signals.keywords,
    },
    model: "gpt-4o-mini",
  };
}

/**
 * Download audio from Drive and transcribe with Whisper.
 * Stores the full transcript as extracted_text.
 */
async function extractAudio(
  derivative: DealFileDerivative
): Promise<ExtractorResult> {
  if (!derivative.google_file_id) {
    return { extractedText: null, structuredFields: null, model: null };
  }

  const buffer = await downloadDriveFile(derivative.user_id, derivative.google_file_id);

  if (buffer.length > MAX_AUDIO_BYTES) {
    return {
      extractedText: `Audio too large for Whisper API (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 25 MB limit).`,
      structuredFields: null,
      model: null,
    };
  }

  const transcript = await transcribeAudio(buffer, derivative.original_file_name);

  if (!transcript) {
    return { extractedText: null, structuredFields: null, model: null };
  }

  return {
    extractedText: transcript,
    structuredFields: {
      transcript_length: transcript.length,
      word_count: transcript.split(/\s+/).filter(Boolean).length,
    },
    model: "whisper-1",
  };
}

/** Download spreadsheet from Drive and extract CSV rows with xlsx. */
async function extractSpreadsheet(
  derivative: DealFileDerivative
): Promise<ExtractorResult> {
  if (!derivative.google_file_id) {
    return { extractedText: null, structuredFields: null, model: null };
  }

  const buffer = await downloadDriveFile(derivative.user_id, derivative.google_file_id);
  // extractTextFromBuffer never throws — returns a diagnostic note on failure
  const text = await extractTextFromBuffer(buffer, derivative.original_file_name);
  const isNote = text.startsWith("[Text extraction note:");

  return {
    extractedText: text || null,
    structuredFields: {
      char_count: isNote ? 0 : text.length,
      row_count: isNote ? 0 : text.split("\n").filter(Boolean).length,
      extraction_note: isNote ? text : null,
    },
    model: "xlsx",
  };
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
