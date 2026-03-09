/**
 * entityFileService
 *
 * Additive pipeline step that runs AFTER the existing deal upload/entry pipeline.
 * Saves files and text into the new entity-fact-evidence tables without touching
 * any existing deal tables.
 *
 * All public functions are non-fatal — they log errors but never throw.
 * The existing pipeline continues even if this service fails.
 */

import {
  getEntityByLegacyDealId,
  insertEntityFile,
  upsertFileText,
  getFactDefinitionsForEntityType,
} from "@/lib/db/entities";
import { chunkAndStoreText } from "./textChunkingService";
import { logFileUploaded, logTextExtracted, logFactsExtracted } from "./entityEventService";
import { extractFactsFromText } from "../facts/factExtractionService";
import { reconcileFacts } from "../facts/factReconciliationService";
import { scoreAndPersistKpis } from "@/lib/kpi/kpiScoringService";
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
};

export type IngestFromDealEntryParams = {
  dealId: string;
  userId: string;
  entryContent: string;
  entryTitle?: string | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

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
  text: string
): Promise<void> {
  try {
    // Get applicable fact definitions for this entity type (critical only for speed)
    const allFactDefs = await getFactDefinitionsForEntityType(entity.entity_type_id);
    const criticalFacts = allFactDefs.filter((fd) => fd.is_critical);
    if (criticalFacts.length === 0) return;

    // Extract facts from text
    const extractionResult = await extractFactsFromText(text, criticalFacts, entity.title);
    if (extractionResult.candidates.length === 0) return;

    // Reconcile with existing entity_fact_values
    const reconcileResult = await reconcileFacts({
      entityId: entity.id,
      fileId: entityFileId,
      entityTitle: entity.title,
      factDefinitions: criticalFacts,
      candidates: extractionResult.candidates,
      extractor_version: extractionResult.extractor_version,
    });

    await logFactsExtracted(entity.id, entityFileId, {
      facts_found: extractionResult.candidates.length,
      facts_inserted: reconcileResult.facts_inserted,
      facts_updated: reconcileResult.facts_updated,
      facts_conflicted: reconcileResult.facts_conflicted,
      model: extractionResult.model_name,
    });

    // Recalculate KPI scorecard after facts are updated (non-fatal)
    scoreAndPersistKpis(entity.id, entity.entity_type_id).catch((err) => {
      console.error("[entityFileService] KPI scoring failed (non-fatal):", err);
    });
  } catch (err) {
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

      await upsertFileText({
        file_id: entityFile.id,
        full_text: isNote ? null : params.extractedText,
        extraction_method: params.extractionMethod ?? "unknown",
        extraction_status: status,
        metadata_json: isNote ? { note: params.extractedText } : {},
      });

      if (!isNote) {
        // 4. Chunk the text for fact extraction
        const chunkCount = await chunkAndStoreText(entityFile.id, params.extractedText);

        await logTextExtracted(entity.id, entityFile.id, {
          extraction_method: params.extractionMethod,
          chunk_count: chunkCount,
        });

        // 5. Extract facts (critical subset, non-fatal)
        await runFactExtraction(entity, entityFile.id, params.extractedText);
      }
    } else {
      // No text — mark as skipped so we know it was processed
      await upsertFileText({
        file_id: entityFile.id,
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
 * Called after a text entry is saved to deal_sources.
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
    });

    if (!entityFile) return;

    await logFileUploaded(entity.id, entityFile.id, { source_type: "pasted_text" });

    // Store full text + chunks
    await upsertFileText({
      file_id: entityFile.id,
      full_text: params.entryContent,
      extraction_method: "passthrough",
      extraction_status: "done",
    });

    const chunkCount = await chunkAndStoreText(entityFile.id, params.entryContent);

    await logTextExtracted(entity.id, entityFile.id, {
      extraction_method: "passthrough",
      chunk_count: chunkCount,
    });

    // Extract facts from pasted text (critical subset, non-fatal)
    await runFactExtraction(entity, entityFile.id, params.entryContent);
  } catch (err) {
    console.error("[entityFileService] ingestFromDealEntry failed (non-fatal):", err);
  }
}
