/**
 * dealFactSeedService
 *
 * Seeds entity_fact_values from manually entered deal creation fields.
 * Called immediately after a deal is created so that:
 *   1. The Facts tab shows manual inputs right away.
 *   2. When a CIM/listing is uploaded, the reconciliation service can detect
 *      conflicts between the manual values and the extracted values.
 *
 * Facts seeded here have value_source_type = "user_override" so the conflict
 * detection in factReconciliationService will surface them to the user.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getEntityByLegacyDealId,
  getFactDefinitionsForEntityType,
  upsertEntityFactValue,
} from "@/lib/db/entities";

// Map from deal creation field → fact_definition key
const DEAL_FIELD_TO_FACT_KEY: Record<string, string> = {
  asking_price: "asking_price",
  sde:          "sde_latest",
  industry:     "industry",
  location:     "location",
};

export type DealSeedFields = {
  asking_price?: string | null;
  sde?: string | null;
  industry?: string | null;
  location?: string | null;
  state?: string | null;
  county?: string | null;
  city?: string | null;
};

/**
 * Seeds manual fact values from deal creation fields into entity_fact_values.
 * Non-fatal — logs errors but never throws.
 */
export async function seedManualFactsFromDeal(
  dealId: string,
  userId: string,
  fields: DealSeedFields
): Promise<void> {
  try {
    const entity = await getEntityByLegacyDealId(dealId, userId);
    if (!entity) {
      console.warn("[dealFactSeedService] Entity not found for deal", dealId);
      return;
    }

    const factDefs = await getFactDefinitionsForEntityType(entity.entity_type_id);
    const factDefByKey = new Map(factDefs.map((fd) => [fd.key, fd]));

    // Build location string from structured fields if no flat location provided
    const locationValue =
      fields.location?.trim() ||
      [fields.city, fields.county, fields.state].filter(Boolean).join(", ") ||
      null;

    const toSeed: { factKey: string; value: string }[] = [];

    if (fields.asking_price?.trim()) {
      toSeed.push({ factKey: "asking_price", value: fields.asking_price.trim() });
    }
    if (fields.sde?.trim()) {
      toSeed.push({ factKey: "sde_latest", value: fields.sde.trim() });
    }
    if (fields.industry?.trim()) {
      toSeed.push({ factKey: "industry", value: fields.industry.trim() });
    }
    if (locationValue) {
      toSeed.push({ factKey: "location", value: locationValue });
    }

    for (const { factKey, value } of toSeed) {
      const fd = factDefByKey.get(factKey);
      if (!fd) {
        console.warn(`[dealFactSeedService] Fact definition not found for key "${factKey}"`);
        continue;
      }

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

    console.log(`[dealFactSeedService] Seeded ${toSeed.length} manual facts for entity ${entity.id}`);
  } catch (err) {
    console.error("[dealFactSeedService] seedManualFactsFromDeal failed (non-fatal):", err);
  }
}
