/**
 * UI Compatibility Adapters
 *
 * The existing DealIntelligencePanel and DealEntriesList components consume
 * DealSourceAnalysis[] and DealChangeLogItem[]. Phase 3 will eventually
 * produce DealInsight rows instead, but until then these adapters let the
 * new data model coexist with the old UI without any component changes.
 *
 * Usage:
 *   import { insightToAnalysis } from "@/lib/db/compat";
 *   const legacyAnalyses = latestInsight ? [insightToAnalysis(latestInsight)] : [];
 */

import type {
  DealInsight,
  DealOpinion,
  DealSourceAnalysis,
  ExtractedFacts,
  SourceType,
  DealFileDerivative,
  DealStructuredFields,
} from "@/types";

// ─── Empty defaults ───────────────────────────────────────────────────────────

const EMPTY_FACTS: ExtractedFacts = {
  business_name: null,
  asking_price: null,
  revenue: null,
  sde: null,
  ebitda: null,
  industry: null,
  location: null,
  employees: null,
  rent: null,
  lease_term: null,
  ff_and_e: null,
  inventory: null,
  growth_claims: [],
  other_key_facts: [],
};

// ─── DealInsight → DealSourceAnalysis ────────────────────────────────────────

/**
 * Map a DealInsight row to the DealSourceAnalysis shape consumed by
 * DealIntelligencePanel. This lets the existing panel render deal-level
 * AI outputs without modification.
 *
 * Only the fields the panel actually reads are populated:
 *   - summary (verdict_reasoning)
 *   - red_flags (risk_flags flattened to strings)
 *   - missing_information
 *   - broker_questions
 *   - extracted_facts (empty until Phase 3 populates structured_fields)
 */
export function insightToAnalysis(insight: DealInsight): DealSourceAnalysis {
  return {
    id: insight.id,
    deal_source_id: "",          // no single source — deal-level
    deal_id: insight.deal_id,
    user_id: insight.user_id,
    generated_title: insight.ai_verdict
      ? `${insight.ai_verdict} — Score ${insight.ai_deal_score ?? "?"}/100`
      : "AI Deal Analysis",
    detected_type: "unknown" as SourceType,
    summary: insight.verdict_reasoning ?? insight.running_summary ?? null,
    extracted_facts: EMPTY_FACTS,
    red_flags: insight.risk_flags.map((f) => f.flag),
    missing_information: insight.missing_information,
    broker_questions: insight.broker_questions,
    created_at: insight.created_at,
  };
}

// ─── DealOpinion → DealSourceAnalysis ────────────────────────────────────────

/**
 * Map a DealOpinion (Phase 3+) to the DealSourceAnalysis shape consumed by
 * DealIntelligencePanel. Preferred over insightToAnalysis for new analysis runs.
 */
export function opinionToAnalysis(opinion: DealOpinion): DealSourceAnalysis {
  return {
    id: opinion.id,
    deal_source_id: "",
    deal_id: opinion.deal_id,
    user_id: opinion.user_id,
    generated_title: opinion.ai_verdict
      ? `${opinion.ai_verdict} — Score ${opinion.ai_deal_score ?? "?"}/100`
      : "AI Deal Analysis",
    detected_type: "unknown" as SourceType,
    summary: opinion.running_summary ?? null,
    extracted_facts: EMPTY_FACTS,
    red_flags: opinion.risk_flags.map((f) => f.flag),
    missing_information: opinion.missing_information,
    broker_questions: opinion.broker_questions,
    created_at: opinion.created_at,
  };
}

// ─── DealFileDerivative structured_fields → ExtractedFacts ───────────────────

/**
 * Map the structured_fields stored on a derivative to the ExtractedFacts
 * shape used by ExtractedFactsCard. Allows the existing facts card to render
 * Phase 3 outputs without modification.
 */
export function derivativeFieldsToFacts(
  fields: DealStructuredFields
): Partial<ExtractedFacts> {
  return {
    asking_price: fields.asking_price,
    revenue: fields.revenue,
    sde: fields.sde,
    ebitda: fields.ebitda,
    rent: fields.rent_monthly,
    employees: fields.headcount,
    other_key_facts: [
      ...(fields.capacity ? [`Capacity: ${fields.capacity}`] : []),
      ...(fields.enrollment ? [`Enrollment: ${fields.enrollment}`] : []),
      ...(fields.seller_role ? [`Seller role: ${fields.seller_role}`] : []),
      ...(fields.lease_expiry ? [`Lease expiry: ${fields.lease_expiry}`] : []),
      ...(fields.other_facts ?? []),
    ],
    growth_claims: [],
  };
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

/**
 * Merge structured_fields from multiple derivatives into a single ExtractedFacts.
 * Later derivatives override earlier ones for scalar fields; arrays are unioned.
 * Used by DealIntelligencePanel to show a consolidated facts view.
 */
export function mergeDerivativeFields(
  derivatives: DealFileDerivative[]
): ExtractedFacts {
  const merged: ExtractedFacts = { ...EMPTY_FACTS };

  for (const d of derivatives) {
    if (!d.structured_fields) continue;
    const partial = derivativeFieldsToFacts(d.structured_fields);

    const scalarKeys: (keyof ExtractedFacts)[] = [
      "asking_price", "revenue", "sde", "ebitda",
      "industry", "location", "employees", "rent",
      "lease_term", "ff_and_e", "inventory",
    ];

    for (const key of scalarKeys) {
      const val = partial[key];
      if (val !== null && val !== undefined) {
        (merged as Record<string, unknown>)[key] = val;
      }
    }

    if (Array.isArray(partial.other_key_facts)) {
      merged.other_key_facts = [
        ...new Set([...merged.other_key_facts, ...partial.other_key_facts]),
      ];
    }
  }

  return merged;
}
