/**
 * entityFileService
 *
 * Additive pipeline step that runs AFTER the existing deal upload/entry pipeline.
 * Saves files and text into the new entity-fact-evidence tables without touching
 * any existing deal tables.
 *
 * All public functions are non-fatal — they log errors but never throw.
 * The existing pipeline continues even if this service fails.
 *
 * Migration 026 changes:
 * - upsertFileText now returns the FileText record (with id) so we can pass
 *   file_text_id to chunkAndStoreText for chunk provenance.
 * - createProcessingRun / updateProcessingRun used for fact_extraction runs.
 * - logFileUploaded / logTextExtracted / logFactsExtracted pass run_id.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getEntityByLegacyDealId,
  insertEntityFile,
  upsertFileText,
  getFactDefinitionsForEntityType,
  createProcessingRun,
  updateProcessingRun,
} from "@/lib/db/entities";
import { chunkAndStoreText } from "./textChunkingService";
import { logFileUploaded, logTextExtracted, logFactsExtracted } from "./entityEventService";
import { extractFactsFromText } from "../facts/factExtractionService";
import { reconcileFacts } from "../facts/factReconciliationService";
import { runTriageSummary } from "./triageSummaryService";
import type { Entity } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngestFromDealUploadParams = {
  dealId: string;
  userId: string;
  googleFileId: string;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: string;
  documentType?: string | null;
  extractedText?: string | null;
  extractionMethod?: string;
  title?: string | null;
  summary?: string | null;
  webViewLink?: string | null;
  driveCreatedTime?: string | null;
};

export type IngestFromDealEntryParams = {
  dealId: string;
  userId: string;
  entryContent: string;
  entryTitle?: string | null;
  entrySummary?: string | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Stamps latest_source_at = now() unconditionally (so the UI can show when
 * new content arrived), and marks deep_analysis_stale = true only if a deep
 * analysis has already been run (so the stale banner only appears when relevant).
 * Called whenever new text is successfully stored.
 */
async function markDeepAnalysisStale(entityId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Always update latest_source_at so the UI knows when content last changed
    await supabase
      .from("entities")
      .update({ latest_source_at: now })
      .eq("id", entityId);

    // Only set stale if a deep analysis has actually been run before
    await supabase
      .from("entities")
      .update({ deep_analysis_stale: true })
      .eq("id", entityId)
      .not("deep_analysis_run_at", "is", null);
  } catch (err) {
    console.error("[entityFileService] markDeepAnalysisStale failed (non-fatal):", err);
  }
}

async function resolveEntity(dealId: string, userId: string): Promise<Entity | null> {
  try {
    return await getEntityByLegacyDealId(dealId, userId);
  } catch (err) {
    console.error("[entityFileService] resolveEntity failed:", err);
    return null;
  }
}

async function runFactExtraction(
  entity: Entity,
  entityFileId: string,
  text: string,
  dealId: string,
  fileTextId?: string | null
): Promise<void> {
  // Create a processing_run record for this fact extraction
  const run = await createProcessingRun({
    entity_id: entity.id,
    run_type: "fact_extraction",
    triggered_by_type: "upload_event",
    related_file_id: entityFileId,
    related_text_id: fileTextId ?? null,
  }).catch(() => null);

  const runId = run?.id ?? null;

  try {
    await updateProcessingRun(runId ?? "", { status: "running" }).catch(() => {});

    // Get applicable fact definitions for this entity type (critical only for speed)
    const allFactDefs = await getFactDefinitionsForEntityType(entity.entity_type_id);
    const criticalFacts = allFactDefs.filter((fd) => fd.is_critical);
    if (criticalFacts.length === 0) {
      if (runId) await updateProcessingRun(runId, { status: "skipped", output_summary_json: { reason: "no_critical_facts" } });
      return;
    }

    // Extract facts from text
    const extractionResult = await extractFactsFromText(text, criticalFacts, entity.title);
    if (extractionResult.candidates.length === 0) {
      if (runId) await updateProcessingRun(runId, { status: "completed", output_summary_json: { facts_found: 0 } });
      return;
    }

    // Reconcile with existing entity_fact_values
    const reconcileResult = await reconcileFacts({
      entityId: entity.id,
      fileId: entityFileId,
      entityTitle: entity.title,
      factDefinitions: criticalFacts,
      candidates: extractionResult.candidates,
      extractor_version: extractionResult.extractor_version,
    });

    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        model_name: extractionResult.model_name,
        output_summary_json: {
          facts_found: extractionResult.candidates.length,
          facts_inserted: reconcileResult.facts_inserted,
          facts_updated: reconcileResult.facts_updated,
          facts_conflicted: reconcileResult.facts_conflicted,
        },
      });
    }

    await logFactsExtracted(entity.id, entityFileId, {
      facts_found: extractionResult.candidates.length,
      facts_inserted: reconcileResult.facts_inserted,
      facts_updated: reconcileResult.facts_updated,
      facts_conflicted: reconcileResult.facts_conflicted,
      model: extractionResult.model_name,
    }, { runId });

    // Run triage summary after facts are updated (non-fatal).
    // This is the only AI analysis that runs automatically on intake.
    // Deep analysis (KPI scoring, deal assessment) is user-triggered only.
    runTriageSummary(entity.id, entity.entity_type_id, dealId, entity.title).catch((err) => {
      console.error("[entityFileService] triage summary failed (non-fatal):", err);
    });
  } catch (err) {
    if (runId) {
      await updateProcessingRun(runId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
    console.error("[entityFileService] runFactExtraction failed (non-fatal):", err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called after a file is uploaded to Google Drive.
 * Creates an entity_file record and stores extracted text + chunks.
 */
export async function ingestFromDealUpload(
  params: IngestFromDealUploadParams
): Promise<void> {
  try {
    const entity = await resolveEntity(params.dealId, params.userId);
    if (!entity) {
      // Entity bridge not yet set up — skip silently
      return;
    }

    // 1. Create entity_file record
    const entityFile = await insertEntityFile({
      entity_id: entity.id,
      legacy_deal_id: params.dealId,
      storage_path: params.googleFileId,
      file_name: params.originalFileName,
      mime_type: params.mimeType,
      file_size_bytes: params.fileSizeBytes,
      source_type: params.sourceType,
      document_type: params.documentType ?? null,
      uploaded_by: params.userId,
      metadata_json: { google_file_id: params.googleFileId },
      title: params.title ?? null,
      summary: params.summary ?? null,
      web_view_link: params.webViewLink ?? null,
      drive_created_time: params.driveCreatedTime ?? null,
    });

    if (!entityFile) return;

    // 2. Log the upload event
    await logFileUploaded(entity.id, entityFile.id, {
      file_name: params.originalFileName,
      source_type: params.sourceType,
    });

    // 3. Store extracted text if available
    if (params.extractedText && params.extractedText.trim().length > 0) {
      const isNote = params.extractedText.startsWith("[Text extraction note:");
      const status = isNote ? "skipped" : "done";

      // upsertFileText now returns the record so we can get its id for chunk provenance
      const fileTextRecord = await upsertFileText({
        file_id: entityFile.id,
        text_type: "raw_extracted",
        full_text: isNote ? null : params.extractedText,
        extraction_method: params.extractionMethod ?? "unknown",
        extraction_status: status,
        metadata_json: isNote ? { note: params.extractedText } : {},
      });

      if (!isNote && fileTextRecord) {
        // 4. Chunk the text, linking chunks to the specific text record
        const chunkCount = await chunkAndStoreText(
          entityFile.id,
          params.extractedText,
          fileTextRecord.id
        );

        await logTextExtracted(entity.id, entityFile.id, {
          extraction_method: params.extractionMethod,
          chunk_count: chunkCount,
          text_type: "raw_extracted",
        });

        // 5. Mark deep analysis stale (non-fatal) — new text was added
        markDeepAnalysisStale(entity.id).catch(() => {});

        // 6. Extract facts (critical subset, non-fatal)
        await runFactExtraction(entity, entityFile.id, params.extractedText, params.dealId, fileTextRecord.id);
      }
    } else {
      // No text — mark as skipped so we know it was processed
      await upsertFileText({
        file_id: entityFile.id,
        text_type: "raw_extracted",
        full_text: null,
        extraction_method: params.extractionMethod ?? "none",
        extraction_status: "skipped",
      });
    }
  } catch (err) {
    // Fully non-fatal — never propagate to caller
    console.error("[entityFileService] ingestFromDealUpload failed (non-fatal):", err);
  }
}

/**
 * Called after a text entry is saved.
 * Creates an entity_file record for the pasted text and stores it as a chunk.
 */
export async function ingestFromDealEntry(
  params: IngestFromDealEntryParams
): Promise<void> {
  try {
    const entity = await resolveEntity(params.dealId, params.userId);
    if (!entity) return;

    // Use a synthetic storage path for text entries
    const syntheticPath = `text-entry:${params.dealId}:${Date.now()}`;

    const entityFile = await insertEntityFile({
      entity_id: entity.id,
      legacy_deal_id: params.dealId,
      storage_path: syntheticPath,
      file_name: params.entryTitle ?? "Pasted text entry",
      mime_type: "text/plain",
      file_size_bytes: Buffer.byteLength(params.entryContent, "utf8"),
      source_type: "pasted_text",
      document_type: null,
      uploaded_by: params.userId,
      metadata_json: { is_text_entry: true },
      title: params.entryTitle ?? null,
      summary: params.entrySummary ?? null,
      web_view_link: null,
      drive_created_time: null,
    });

    if (!entityFile) return;

    await logFileUploaded(entity.id, entityFile.id, { source_type: "pasted_text" });

    // Store full text — text_type='raw_extracted' (passthrough for pasted text)
    const fileTextRecord = await upsertFileText({
      file_id: entityFile.id,
      text_type: "raw_extracted",
      full_text: params.entryContent,
      extraction_method: "passthrough",
      extraction_status: "done",
    });

    const chunkCount = await chunkAndStoreText(
      entityFile.id,
      params.entryContent,
      fileTextRecord?.id ?? null
    );

    await logTextExtracted(entity.id, entityFile.id, {
      extraction_method: "passthrough",
      chunk_count: chunkCount,
      text_type: "raw_extracted",
    });

    // Mark deep analysis stale (non-fatal) — new text was added
    markDeepAnalysisStale(entity.id).catch(() => {});

    // Extract facts from pasted text (critical subset, non-fatal)
    await runFactExtraction(entity, entityFile.id, params.entryContent, params.dealId, fileTextRecord?.id ?? null);
  } catch (err) {
    console.error("[entityFileService] ingestFromDealEntry failed (non-fatal):", err);
  }
}
