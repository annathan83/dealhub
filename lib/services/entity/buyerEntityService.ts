/**
 * buyerEntityService
 *
 * Manages the buyer entity — a singleton entity per user that stores
 * buyer acquisition criteria as structured facts.
 *
 * Architecture:
 *   - Each user has exactly one entity of type 'buyer'
 *   - Buyer profile documents flow through the standard entity/fact pipeline
 *   - After fact extraction, syncBuyerProfileFromFacts() reads entity_fact_values
 *     and writes them back to buyer_profiles (the table computeBuyerFit reads)
 *   - Manual form saves also write to entity_fact_values via seedBuyerProfileFacts()
 */

import { createClient } from "@/lib/supabase/server";
import {
  getFactDefinitionsForEntityType,
  upsertEntityFactValue,
  getCurrentFactsForEntity,
  insertEntityFile,
  upsertFileText,
} from "@/lib/db/entities";
import { chunkAndStoreText } from "./textChunkingService";
import { logFileUploaded, logTextExtracted, logFactsExtracted } from "./entityEventService";
import { extractFactsFromText } from "../facts/factExtractionService";
import { reconcileFacts } from "../facts/factReconciliationService";
import { createProcessingRun, updateProcessingRun } from "@/lib/db/entities";
import type { Entity } from "@/types/entity";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";

// ─── Ensure buyer entity ───────────────────────────────────────────────────────

/**
 * Returns the buyer entity for the given user, creating it if it doesn't exist.
 * This is a singleton — one buyer entity per user, identified by owner_user_id
 * and entity_type = 'buyer'.
 */
export async function ensureBuyerEntity(userId: string): Promise<Entity | null> {
  try {
    const supabase = await createClient();

    // Look up the buyer entity type
    const { data: entityType } = await supabase
      .from("entity_types")
      .select("id")
      .eq("key", "buyer")
      .single();

    if (!entityType) {
      console.error("[buyerEntityService] buyer entity type not found");
      return null;
    }

    // Find existing buyer entity for this user
    const { data: existing } = await supabase
      .from("entities")
      .select("*")
      .eq("owner_user_id", userId)
      .eq("entity_type_id", entityType.id)
      .maybeSingle();

    if (existing) {
      return normalizeEntity(existing as Record<string, unknown>);
    }

    // Create the buyer entity
    const { data: created, error } = await supabase
      .from("entities")
      .insert({
        entity_type_id: entityType.id,
        legacy_deal_id: null,
        title: "Buyer Profile",
        subtitle: null,
        status: "active",
        owner_user_id: userId,
        metadata_json: {},
      })
      .select("*")
      .single();

    if (error || !created) {
      console.error("[buyerEntityService] Failed to create buyer entity:", error?.message);
      return null;
    }

    return normalizeEntity(created as Record<string, unknown>);
  } catch (err) {
    console.error("[buyerEntityService] ensureBuyerEntity failed:", err);
    return null;
  }
}

// ─── Sync facts → buyer_profiles ─────────────────────────────────────────────

/**
 * Reads entity_fact_values for the buyer entity and writes them to buyer_profiles.
 * Called after any fact extraction or manual update on the buyer entity.
 *
 * This keeps buyer_profiles (the table computeBuyerFit reads) in sync with
 * the canonical fact store.
 */
export async function syncBuyerProfileFromFacts(
  buyerEntityId: string,
  userId: string
): Promise<void> {
  try {
    const supabase = await createClient();

    const [factValues, factDefs] = await Promise.all([
      getCurrentFactsForEntity(buyerEntityId),
      (async () => {
        const { data: et } = await supabase
          .from("entities")
          .select("entity_type_id")
          .eq("id", buyerEntityId)
          .single();
        if (!et) return [];
        return getFactDefinitionsForEntityType(et.entity_type_id as string);
      })(),
    ]);

    const defById = new Map(factDefs.map((d) => [d.id, d]));

    // Helper to get a raw value for a fact key
    function getRaw(key: string): string | null {
      const def = factDefs.find((d) => d.key === key);
      if (!def) return null;
      const val = factValues.find((v) => v.fact_definition_id === def.id);
      return val?.value_raw ?? null;
    }

    function parseNum(key: string): number | null {
      const raw = getRaw(key);
      if (!raw) return null;
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
      return isNaN(n) ? null : n;
    }

    function parseArray(key: string): string[] {
      const raw = getRaw(key);
      if (!raw) return [];
      // Values may be stored as comma-separated or JSON array
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        // not JSON — treat as comma-separated
      }
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }

    function parseEnum<T extends string>(key: string, allowed: readonly T[]): T | null {
      const raw = getRaw(key)?.toLowerCase().trim() ?? null;
      if (!raw) return null;
      return (allowed.includes(raw as T) ? raw : null) as T | null;
    }

    const profile: Partial<BuyerProfile> & { updated_at: string } = {
      preferred_industries:               parseArray("preferred_industries"),
      excluded_industries:                parseArray("excluded_industries"),
      target_sde_min:                     parseNum("target_sde_min"),
      target_sde_max:                     parseNum("target_sde_max"),
      target_purchase_price_min:          parseNum("target_purchase_price_min"),
      target_purchase_price_max:          parseNum("target_purchase_price_max"),
      preferred_locations:                parseArray("preferred_locations"),
      max_employees:                      parseNum("max_employees"),
      manager_required:                   parseEnum("manager_required", ["yes", "no", "prefer"] as const),
      owner_operator_ok:                  parseEnum("owner_operator_ok", ["yes", "no", "prefer"] as const),
      preferred_business_characteristics: getRaw("preferred_business_characteristics"),
      experience_background:              getRaw("experience_background"),
      acquisition_goals:                  getRaw("acquisition_goals"),
      updated_at:                         new Date().toISOString(),
    };

    await supabase
      .from("buyer_profiles")
      .upsert(
        { user_id: userId, buyer_entity_id: buyerEntityId, ...profile },
        { onConflict: "user_id" }
      );

    console.log(`[buyerEntityService] Synced buyer profile from facts for entity ${buyerEntityId}`);
  } catch (err) {
    console.error("[buyerEntityService] syncBuyerProfileFromFacts failed (non-fatal):", err);
  }
}

// ─── Ingest buyer profile document ───────────────────────────────────────────

export type IngestBuyerProfileParams = {
  userId: string;
  storagePath: string;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  extractedText: string;
  extractionMethod?: string;
  webViewLink?: string | null;
  driveCreatedTime?: string | null;
};

/**
 * Runs the full entity/fact pipeline for a buyer profile document.
 * Mirrors ingestFromDealUpload but targets the buyer entity.
 *
 * After fact extraction, syncs the resulting facts back to buyer_profiles.
 */
export async function ingestBuyerProfileDocument(
  params: IngestBuyerProfileParams
): Promise<{ entityId: string; factsExtracted: number }> {
  const entity = await ensureBuyerEntity(params.userId);
  if (!entity) throw new Error("Could not resolve buyer entity");

  // 1. Create entity_file record
  const entityFile = await insertEntityFile({
    entity_id: entity.id,
    legacy_deal_id: null,
    storage_path: params.storagePath,
    file_name: params.originalFileName,
    mime_type: params.mimeType,
    file_size_bytes: params.fileSizeBytes,
    source_type: "buyer_profile_document",
    document_type: "buyer_profile",
    uploaded_by: params.userId,
    metadata_json: {},
    title: "Buyer Profile",
    summary: null,
    web_view_link: params.webViewLink ?? null,
    drive_created_time: params.driveCreatedTime ?? null,
  });

  if (!entityFile) throw new Error("Failed to create entity_file record");

  // 2. Log upload event
  await logFileUploaded(entity.id, entityFile.id, {
    file_name: params.originalFileName,
    source_type: "buyer_profile_document",
  });

  // 3. Store extracted text + chunks
  const fileTextRecord = await upsertFileText({
    file_id: entityFile.id,
    text_type: "raw_extracted",
    full_text: params.extractedText,
    extraction_method: params.extractionMethod ?? "unknown",
    extraction_status: "done",
    metadata_json: {},
  });

  const chunkCount = await chunkAndStoreText(
    entityFile.id,
    params.extractedText,
    fileTextRecord?.id ?? null
  );

  await logTextExtracted(entity.id, entityFile.id, {
    extraction_method: params.extractionMethod,
    chunk_count: chunkCount,
    text_type: "raw_extracted",
  });

  // 4. Run fact extraction
  const run = await createProcessingRun({
    entity_id: entity.id,
    run_type: "fact_extraction",
    triggered_by_type: "upload_event",
    related_file_id: entityFile.id,
    related_text_id: fileTextRecord?.id ?? null,
  }).catch(() => null);

  const runId = run?.id ?? null;
  let factsExtracted = 0;

  try {
    await updateProcessingRun(runId ?? "", { status: "running" }).catch(() => {});

    const factDefs = await getFactDefinitionsForEntityType(entity.entity_type_id);
    if (factDefs.length > 0) {
      const extractionResult = await extractFactsFromText(
        params.extractedText,
        factDefs,
        "Buyer Profile"
      );

      factsExtracted = extractionResult.candidates.length;

      if (factsExtracted > 0) {
        const reconcileResult = await reconcileFacts({
          entityId: entity.id,
          fileId: entityFile.id,
          entityTitle: "Buyer Profile",
          factDefinitions: factDefs,
          candidates: extractionResult.candidates,
          extractor_version: extractionResult.extractor_version,
        });

        await logFactsExtracted(entity.id, entityFile.id, {
          facts_found: factsExtracted,
          facts_inserted: reconcileResult.facts_inserted,
          facts_updated: reconcileResult.facts_updated,
          facts_conflicted: reconcileResult.facts_conflicted,
          model: extractionResult.model_name,
        }, { runId });

        if (runId) {
          await updateProcessingRun(runId, {
            status: "completed",
            model_name: extractionResult.model_name,
            output_summary_json: {
              facts_found: factsExtracted,
              facts_inserted: reconcileResult.facts_inserted,
              facts_updated: reconcileResult.facts_updated,
              facts_conflicted: reconcileResult.facts_conflicted,
            },
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    if (runId) {
      await updateProcessingRun(runId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
    console.error("[buyerEntityService] Fact extraction failed:", err);
  }

  // 5. Sync facts → buyer_profiles
  await syncBuyerProfileFromFacts(entity.id, params.userId);

  return { entityId: entity.id, factsExtracted };
}

// ─── Seed manual profile into facts ──────────────────────────────────────────

/**
 * Writes buyer_profiles fields into entity_fact_values as user_override facts.
 * Called when the user saves the profile form manually.
 * Ensures the entity fact store stays in sync with manual edits.
 */
export async function seedBuyerProfileFacts(
  userId: string,
  profile: BuyerProfile
): Promise<void> {
  try {
    const entity = await ensureBuyerEntity(userId);
    if (!entity) return;

    const factDefs = await getFactDefinitionsForEntityType(entity.entity_type_id);
    const defByKey = new Map(factDefs.map((d) => [d.key, d]));

    const toSeed: { key: string; value: string }[] = [];

    function addArray(key: string, val: string[] | null | undefined) {
      if (val && val.length > 0) toSeed.push({ key, value: val.join(", ") });
    }
    function addNum(key: string, val: number | null | undefined) {
      if (val != null) toSeed.push({ key, value: String(val) });
    }
    function addText(key: string, val: string | null | undefined) {
      if (val?.trim()) toSeed.push({ key, value: val.trim() });
    }

    addArray("preferred_industries",               profile.preferred_industries);
    addArray("excluded_industries",                profile.excluded_industries);
    addNum  ("target_sde_min",                     profile.target_sde_min);
    addNum  ("target_sde_max",                     profile.target_sde_max);
    addNum  ("target_purchase_price_min",          profile.target_purchase_price_min);
    addNum  ("target_purchase_price_max",          profile.target_purchase_price_max);
    addArray("preferred_locations",                profile.preferred_locations);
    addNum  ("max_employees",                      profile.max_employees);
    addText ("manager_required",                   profile.manager_required);
    addText ("owner_operator_ok",                  profile.owner_operator_ok);
    addText ("preferred_business_characteristics", profile.preferred_business_characteristics);
    addText ("experience_background",              profile.experience_background);
    addText ("acquisition_goals",                  profile.acquisition_goals);

    for (const { key, value } of toSeed) {
      const fd = defByKey.get(key);
      if (!fd) continue;
      await upsertEntityFactValue({
        entity_id: entity.id,
        fact_definition_id: fd.id,
        value_raw: value,
        value_normalized_json: {},
        status: "confirmed",
        confidence: 1.0,
        current_evidence_id: null,
        value_source_type: "user_override",
      });
    }

    console.log(`[buyerEntityService] Seeded ${toSeed.length} buyer profile facts for entity ${entity.id}`);
  } catch (err) {
    console.error("[buyerEntityService] seedBuyerProfileFacts failed (non-fatal):", err);
  }
}

// ─── Internal normalizer ──────────────────────────────────────────────────────

function normalizeEntity(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    entity_type_id: row.entity_type_id as string,
    legacy_deal_id: (row.legacy_deal_id as string | null) ?? null,
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    owner_user_id: (row.owner_user_id as string | null) ?? null,
    workspace_id: (row.workspace_id as string | null) ?? null,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string | null) ?? null,
    deep_analysis_run_at: (row.deep_analysis_run_at as string | null) ?? null,
    deep_analysis_stale: (row.deep_analysis_stale as boolean) ?? false,
    latest_source_at: (row.latest_source_at as string | null) ?? null,
    last_revaluation_at: (row.last_revaluation_at as string | null) ?? null,
    revaluation_stale: (row.revaluation_stale as boolean) ?? false,
  };
}
