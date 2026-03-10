/**
 * factInferenceService
 *
 * Explicit fact inference step — runs AFTER fact extraction, BEFORE scoring.
 *
 * Purpose:
 *   Fact extraction captures values directly found in transcripts/documents.
 *   Fact inference derives or estimates facts from already-known facts.
 *
 * Rules:
 *   - Inferred facts have value_source_type = "ai_inferred"
 *   - Inferred facts never silently overwrite a confirmed or user-entered fact
 *   - Inferred facts enter the same reconciliation flow as extracted facts
 *   - Every inference has a rationale explaining the derivation
 *   - No fake snippet — inferred facts have no document evidence
 *
 * Examples:
 *   enrollment + tuition_monthly → estimated_annual_revenue
 *   revenue + margin assumption  → estimated SDE
 *   asking_price + SDE           → implied multiple
 */

import { getCurrentFactsForEntity, upsertEntityFactValue } from "@/lib/db/entities";
import type { EntityFactValue } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InferredFact = {
  fact_key: string;
  value_raw: string;
  confidence: number;
  rationale: string;
};

export type InferenceResult = {
  inferred: InferredFact[];
  skipped: { fact_key: string; reason: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNumeric(facts: Map<string, EntityFactValue>, key: string): number | null {
  const val = facts.get(key)?.value_raw;
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function getBool(facts: Map<string, EntityFactValue>, key: string): boolean | null {
  const val = facts.get(key)?.value_raw?.toLowerCase();
  if (!val) return null;
  if (val === "true" || val === "yes" || val === "1") return true;
  if (val === "false" || val === "no" || val === "0") return false;
  return null;
}

function isUserConfirmed(facts: Map<string, EntityFactValue>, key: string): boolean {
  const val = facts.get(key);
  return val?.value_source_type === "user_override";
}

function isDocumentBacked(facts: Map<string, EntityFactValue>, key: string): boolean {
  const val = facts.get(key);
  return val?.value_source_type === "ai_extracted";
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Inference Rules ──────────────────────────────────────────────────────────
//
// Each rule:
//   - checks if required inputs are available
//   - checks if the target fact already has a confirmed/document-backed value
//   - computes the inferred value
//   - returns an InferredFact or null (skip)

type InferenceRule = (
  facts: Map<string, EntityFactValue>
) => InferredFact | { skip: string } | null;

const INFERENCE_RULES: InferenceRule[] = [

  // ── 1. Enrollment × Tuition → Estimated Annual Revenue ──────────────────────
  (facts) => {
    const enrollment = getNumeric(facts, "enrollment");
    const tuition = getNumeric(facts, "tuition_monthly");
    if (!enrollment || !tuition) return null;

    // Skip if revenue is already document-backed or user-confirmed
    if (isDocumentBacked(facts, "revenue_latest") || isUserConfirmed(facts, "revenue_latest")) {
      return { skip: "revenue_latest already document-backed or user-confirmed" };
    }

    const estimated = enrollment * tuition * 12;
    return {
      fact_key: "revenue_latest",
      value_raw: String(Math.round(estimated)),
      confidence: 0.65,
      rationale: `Estimated from enrollment (${enrollment}) × monthly tuition ($${tuition}) × 12 months = ${formatCurrency(estimated)}`,
    };
  },

  // ── 2. Revenue × Margin Assumption → Estimated SDE ──────────────────────────
  (facts) => {
    const revenue = getNumeric(facts, "revenue_latest");
    if (!revenue) return null;

    // Only infer SDE if it's completely missing
    if (facts.get("sde_latest")?.value_raw) {
      return { skip: "sde_latest already has a value" };
    }

    // Use a conservative 20% margin assumption for service businesses
    const assumedMargin = 0.20;
    const estimated = revenue * assumedMargin;
    return {
      fact_key: "sde_latest",
      value_raw: String(Math.round(estimated)),
      confidence: 0.35, // low confidence — pure assumption
      rationale: `Estimated from revenue (${formatCurrency(revenue)}) × assumed 20% SDE margin = ${formatCurrency(estimated)}. Verify with actual financials.`,
    };
  },

  // ── 3. Asking Price + SDE → Implied Multiple ────────────────────────────────
  (facts) => {
    const askingPrice = getNumeric(facts, "asking_price");
    const sde = getNumeric(facts, "sde_latest");
    if (!askingPrice || !sde || sde <= 0) return null;

    if (isDocumentBacked(facts, "price_multiple") || isUserConfirmed(facts, "price_multiple")) {
      return { skip: "price_multiple already document-backed or user-confirmed" };
    }

    const multiple = askingPrice / sde;
    return {
      fact_key: "price_multiple",
      value_raw: multiple.toFixed(2),
      confidence: 0.90, // high confidence — pure arithmetic
      rationale: `Calculated from asking price (${formatCurrency(askingPrice)}) ÷ SDE (${formatCurrency(sde)}) = ${multiple.toFixed(2)}x`,
    };
  },

  // ── 4. SDE + Revenue → SDE Margin ───────────────────────────────────────────
  (facts) => {
    const sde = getNumeric(facts, "sde_latest");
    const revenue = getNumeric(facts, "revenue_latest");
    if (!sde || !revenue || revenue <= 0) return null;

    if (isDocumentBacked(facts, "sde_margin") || isUserConfirmed(facts, "sde_margin")) {
      return { skip: "sde_margin already document-backed or user-confirmed" };
    }

    const margin = sde / revenue;
    return {
      fact_key: "sde_margin",
      value_raw: (margin * 100).toFixed(1),
      confidence: 0.90,
      rationale: `Calculated from SDE (${formatCurrency(sde)}) ÷ revenue (${formatCurrency(revenue)}) = ${formatPct(margin)} margin`,
    };
  },

  // ── 5. Revenue per Employee ──────────────────────────────────────────────────
  (facts) => {
    const revenue = getNumeric(facts, "revenue_latest");
    const ftEmployees = getNumeric(facts, "employees_ft") ?? 0;
    const ptEmployees = getNumeric(facts, "employees_pt") ?? 0;
    const totalEmployees = ftEmployees + ptEmployees * 0.5; // PT counts as 0.5 FTE
    if (!revenue || totalEmployees <= 0) return null;

    if (facts.get("revenue_per_employee")?.value_raw) {
      return { skip: "revenue_per_employee already has a value" };
    }

    const rpe = revenue / totalEmployees;
    return {
      fact_key: "revenue_per_employee",
      value_raw: String(Math.round(rpe)),
      confidence: 0.85,
      rationale: `Calculated from revenue (${formatCurrency(revenue)}) ÷ ${totalEmployees} FTE = ${formatCurrency(rpe)} per employee`,
    };
  },

  // ── 6. Capacity + Enrollment → Utilization Rate ─────────────────────────────
  (facts) => {
    const capacity = getNumeric(facts, "student_capacity") ?? getNumeric(facts, "capacity");
    const enrollment = getNumeric(facts, "enrollment");
    if (!capacity || !enrollment || capacity <= 0) return null;

    if (facts.get("utilization_rate")?.value_raw) {
      return { skip: "utilization_rate already has a value" };
    }

    const utilization = enrollment / capacity;
    return {
      fact_key: "utilization_rate",
      value_raw: (utilization * 100).toFixed(1),
      confidence: 0.90,
      rationale: `Calculated from enrollment (${enrollment}) ÷ capacity (${capacity}) = ${formatPct(utilization)} utilization`,
    };
  },

  // ── 7. Rent + Square Footage → Rent per Sq Ft ───────────────────────────────
  (facts) => {
    const rent = getNumeric(facts, "monthly_rent") ?? getNumeric(facts, "annual_rent");
    const sqft = getNumeric(facts, "square_footage");
    if (!rent || !sqft || sqft <= 0) return null;

    if (facts.get("rent_per_sqft")?.value_raw) {
      return { skip: "rent_per_sqft already has a value" };
    }

    // Normalize to annual rent per sqft
    const annualRent = facts.get("monthly_rent")?.value_raw ? rent * 12 : rent;
    const rentPerSqft = annualRent / sqft;
    return {
      fact_key: "rent_per_sqft",
      value_raw: rentPerSqft.toFixed(2),
      confidence: 0.85,
      rationale: `Calculated from annual rent (${formatCurrency(annualRent)}) ÷ ${sqft.toLocaleString()} sq ft = $${rentPerSqft.toFixed(2)}/sq ft`,
    };
  },

  // ── 8. Owner Hours → Owner Dependence Signal ─────────────────────────────────
  (facts) => {
    const ownerHours = getNumeric(facts, "owner_hours_per_week");
    const managerInPlace = getBool(facts, "manager_in_place");
    if (ownerHours === null) return null;

    if (facts.get("owner_dependence_level")?.value_raw) {
      return { skip: "owner_dependence_level already has a value" };
    }

    let level: string;
    let confidence = 0.75;
    if (ownerHours >= 50) {
      level = "high";
    } else if (ownerHours >= 30) {
      level = managerInPlace === true ? "medium" : "high";
    } else if (ownerHours >= 15) {
      level = managerInPlace === true ? "low" : "medium";
    } else {
      level = "low";
    }

    return {
      fact_key: "owner_dependence_level",
      value_raw: level,
      confidence,
      rationale: `Inferred from owner hours (${ownerHours}h/week)${managerInPlace !== null ? ` and manager in place: ${managerInPlace}` : ""}`,
    };
  },

];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all inference rules against the current facts for an entity.
 * Returns inferred facts that should be fed into the reconciliation pipeline.
 *
 * Inferred facts are NOT directly written here — they are returned as candidates
 * to be passed through reconcileFacts() like any other extraction result.
 */
export async function runFactInference(entityId: string): Promise<InferenceResult> {
  const factValues = await getCurrentFactsForEntity(entityId);

  // Build a map keyed by fact_definition key for easy lookup
  // We need the fact_definitions to resolve keys — use the value's fact_definition_id
  // For inference we work with the raw fact values directly
  const factsByKey = new Map<string, EntityFactValue>();
  for (const fv of factValues) {
    // We'll use the fact_definition_id as a proxy key here
    // The actual key resolution happens in the caller via factDefIdToKey map
    factsByKey.set(fv.fact_definition_id, fv);
  }

  // Resolve fact_definition_id → fact_key by fetching all fact definitions
  const { createClient } = await import("@/lib/supabase/server");
  const sb = await createClient();
  const { data: factDefs } = await sb.from("fact_definitions").select("id, key");
  const idToKey = new Map<string, string>((factDefs ?? []).map((fd: { id: string; key: string }) => [fd.id, fd.key]));

  // Rebuild map keyed by fact key
  const factsByFactKey = new Map<string, EntityFactValue>();
  for (const fv of factValues) {
    const key = idToKey.get(fv.fact_definition_id);
    if (key) factsByFactKey.set(key, fv);
  }

  const inferred: InferredFact[] = [];
  const skipped: { fact_key: string; reason: string }[] = [];

  for (const rule of INFERENCE_RULES) {
    try {
      const result = rule(factsByFactKey);
      if (!result) continue;
      if ("skip" in result) {
        skipped.push({ fact_key: "unknown", reason: result.skip });
        continue;
      }
      inferred.push(result);
    } catch (err) {
      console.error("[factInferenceService] Rule failed (non-fatal):", err);
    }
  }

  return { inferred, skipped };
}

/**
 * Run fact inference and write the results directly as ai_inferred fact values.
 * Respects existing user-confirmed and document-backed facts (never overwrites them).
 *
 * Called as an explicit pipeline step after fact extraction.
 */
export async function runAndApplyFactInference(
  entityId: string,
  // entityTypeId is reserved for future industry-specific inference overlays
  _entityTypeId?: string
): Promise<{ applied: number; skipped: number }> {
  const { inferred, skipped } = await runFactInference(entityId);

  if (inferred.length === 0) {
    return { applied: 0, skipped: skipped.length };
  }

  // Fetch fact definitions to resolve keys → IDs
  const { createClient } = await import("@/lib/supabase/server");
  const sb = await createClient();
  const { data: factDefs } = await sb.from("fact_definitions").select("id, key");
  const keyToId = new Map<string, string>((factDefs ?? []).map((fd: { id: string; key: string }) => [fd.key, fd.id]));

  let applied = 0;

  for (const inf of inferred) {
    const factDefId = keyToId.get(inf.fact_key);
    if (!factDefId) {
      console.warn(`[factInferenceService] No fact_definition found for key: ${inf.fact_key}`);
      continue;
    }

    // upsertEntityFactValue respects user_override — will not overwrite
    const result = await upsertEntityFactValue({
      entity_id: entityId,
      fact_definition_id: factDefId,
      value_raw: inf.value_raw,
      value_normalized_json: { inferred: true, rationale: inf.rationale },
      status: "estimated",
      confidence: inf.confidence,
      value_source_type: "ai_inferred",
    });

    if (result) applied++;
  }

  console.log(
    `[factInferenceService] entityId=${entityId}: applied=${applied}, skipped=${skipped.length}`
  );

  return { applied, skipped: skipped.length };
}
