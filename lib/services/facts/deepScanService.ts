/**
 * deepScanService
 *
 * Runs a full fact extraction pass over all stored file_text for an entity.
 * Unlike the initial upload path (critical facts only, ≈13 facts), this pass
 * targets the FULL supported fact set for the entity type.
 *
 * Design:
 *   - Reads from file_texts (already stored) — no re-upload needed
 *   - Processes each file's text through extractFactsFromText with all fact defs
 *   - Respects value_source_type='user_override': confirmed/edited facts are never overwritten
 *   - Writes results into fact_evidence + entity_fact_values via reconcileFacts
 *   - Run tracking via processing_runs (deep_scan_* columns removed in migration 027)
 *
 * Can be called from:
 *   - POST /api/deals/[id]/deep-scan  (user-triggered)
 *   - deepAnalysisOrchestrator (as part of the full deep analysis pipeline)
 */

import {
  getEntityByLegacyDealId,
  getFactDefinitionsForEntityType,
  getFileTextsForEntity,
} from "@/lib/db/entities";
import { extractFactsFromText } from "./factExtractionService";
import { reconcileFacts } from "./factReconciliationService";
import { logEntityEvent } from "../entity/entityEventService";
import { scoreAndPersistKpis } from "@/lib/kpi/kpiScoringService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeepScanResult = {
  entity_id: string;
  files_processed: number;
  facts_found: number;
  facts_inserted: number;
  facts_updated: number;
  conflicts_found: number;
  error?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Max chars to send per file — larger than critical scan (6000) to get more coverage
const MAX_TEXT_CHARS = 12000;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a full fact extraction pass for an entity.
 * Reads all stored file_text, extracts the full fact set, reconciles results.
 * Non-fatal — always returns a result object, never throws.
 */
export async function runDeepScan(
  entityId: string,
  entityTypeId: string,
  entityTitle: string
): Promise<DeepScanResult> {
  const result: DeepScanResult = {
    entity_id: entityId,
    files_processed: 0,
    facts_found: 0,
    facts_inserted: 0,
    facts_updated: 0,
    conflicts_found: 0,
  };

  try {
    await logEntityEvent(entityId, "deep_scan_started", {
      triggered_at: new Date().toISOString(),
    });

    // Load all fact definitions (not just critical ones)
    const allFactDefs = await getFactDefinitionsForEntityType(entityTypeId);
    if (allFactDefs.length === 0) {
      return result;
    }

    // Load all stored file texts for this entity
    const fileTexts = await getFileTextsForEntity(entityId);
    if (fileTexts.length === 0) {
      return result;
    }

    // Process each file
    for (const { file_id, full_text, file_name } of fileTexts) {
      try {
        const textToProcess = full_text.slice(0, MAX_TEXT_CHARS);

        const extraction = await extractFactsFromText(
          textToProcess,
          allFactDefs,
          entityTitle
        );

        result.facts_found += extraction.candidates.length;

        if (extraction.candidates.length === 0) continue;

        const reconcileResult = await reconcileFacts({
          entityId,
          fileId: file_id,
          entityTitle,
          factDefinitions: allFactDefs,
          candidates: extraction.candidates,
          extractor_version: `deep-scan-${extraction.extractor_version}`,
        });

        result.facts_inserted += reconcileResult.facts_inserted;
        result.facts_updated += reconcileResult.facts_updated;
        result.conflicts_found += reconcileResult.facts_conflicted;
        result.files_processed++;

        console.log(
          `[deepScanService] Processed "${file_name}": ` +
          `${extraction.candidates.length} candidates, ` +
          `${reconcileResult.facts_inserted} inserted, ` +
          `${reconcileResult.facts_updated} updated, ` +
          `${reconcileResult.facts_conflicted} conflicts`
        );
      } catch (fileErr) {
        console.error(`[deepScanService] Failed to process file ${file_id}:`, fileErr);
      }
    }

    // Recalculate KPI scorecard with the new facts
    await scoreAndPersistKpis(entityId, entityTypeId).catch((err) => {
      console.error("[deepScanService] KPI rescore failed (non-fatal):", err);
    });

    await logEntityEvent(entityId, "deep_scan_completed", {
      files_processed: result.files_processed,
      facts_found: result.facts_found,
      facts_inserted: result.facts_inserted,
      facts_updated: result.facts_updated,
      conflicts_found: result.conflicts_found,
    });

    return result;
  } catch (err) {
    console.error("[deepScanService] runDeepScan failed:", err);
    result.error = err instanceof Error ? err.message : "Unknown error";
    return result;
  }
}

/**
 * Convenience wrapper that resolves entity from legacy deal ID.
 * Used by the API route.
 */
export async function runDeepScanForDeal(
  dealId: string,
  userId: string
): Promise<DeepScanResult> {
  const entity = await getEntityByLegacyDealId(dealId, userId);
  if (!entity) {
    return {
      entity_id: "",
      files_processed: 0,
      facts_found: 0,
      facts_inserted: 0,
      facts_updated: 0,
      conflicts_found: 0,
      error: "Entity not found",
    };
  }

  return runDeepScan(entity.id, entity.entity_type_id, entity.title);
}
