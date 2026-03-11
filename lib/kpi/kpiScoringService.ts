/**
 * KPI Scoring Service
 *
 * Reads entity_fact_values for an entity, maps them to KpiFactInputs,
 * runs each KPI scoring function from kpiConfig, and returns a
 * KpiScorecardResult.
 *
 * This is the Layer 3 → Layer 4 bridge:
 *   Facts (entity_fact_values) → KPI Scores → AI Analysis input
 *
 * The result is stored in analysis_snapshots with analysis_type = 'kpi_scorecard'.
 * It can also be returned directly from an API route for real-time display.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  insertAnalysisSnapshot,
  createProcessingRun,
  updateProcessingRun,
} from "@/lib/db/entities";
import { logAnalysisRefreshed } from "@/lib/services/entity/entityEventService";
import { extractFactInputs } from "./factRegistry";
import { KPI_DEFINITIONS, type KpiFactInputs, type KpiScorecardResult, type KpiScore } from "./kpiConfig";
import type { EntityFactValue } from "@/types/entity";

// ─── Score history helpers ────────────────────────────────────────────────────

export type ScoreTriggerType = "fact_change" | "manual" | "file_upload" | "extraction" | "deep_scan" | "system";

/**
 * Append a row to score_history for every KPI recalculation.
 * Includes confidence metrics based on source provenance of facts used.
 * Non-fatal — errors are logged but never thrown.
 */
async function writeScoreHistory(params: {
  entityId: string;
  scorecard: KpiScorecardResult;
  confidence: ScoringConfidence;
  triggerType: ScoreTriggerType;
  triggerReason?: string | null;
  changedFactKey?: string | null;
  snapshotId?: string | null;
}): Promise<string | null> {
  try {
    const supabase = await createClient();
    const overall10 = params.scorecard.overall_score !== null
      ? Math.round(params.scorecard.overall_score * 10) / 10
      : null;

    const { data } = await supabase.from("score_history").insert({
      entity_id:             params.entityId,
      overall_score:         params.scorecard.overall_score,
      overall_score_10:      overall10,
      overall_score_100:     params.scorecard.overall_score_100,
      coverage_pct:          params.scorecard.coverage_pct,
      kpi_count:             params.scorecard.kpis.length,
      missing_count:         params.scorecard.missing_count,
      trigger_type:          params.triggerType,
      trigger_reason:        params.triggerReason ?? null,
      changed_fact_key:      params.changedFactKey ?? null,
      snapshot_id:           params.snapshotId ?? null,
      // Confidence fields
      confidence_score:      params.confidence.confidence_score,
      total_facts_used:      params.confidence.total_facts_used,
      document_backed_count: params.confidence.document_backed_count,
      manual_count:          params.confidence.manual_count,
      inferred_count:        params.confidence.inferred_count,
      override_count:        params.confidence.override_count,
    }).select("id").single();

    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.error("[kpiScoringService] writeScoreHistory failed (non-fatal):", err);
    return null;
  }
}

/**
 * Write one score_components row per KPI for a scoring run.
 * Non-fatal.
 */
async function writeScoreComponents(params: {
  entityId: string;
  scoreHistoryId: string | null;
  snapshotId: string | null;
  kpis: KpiScore[];
}): Promise<void> {
  if (!params.scoreHistoryId || params.kpis.length === 0) return;
  try {
    const supabase = await createClient();
    const rows = params.kpis.map((kpi) => ({
      entity_id:        params.entityId,
      score_history_id: params.scoreHistoryId,
      snapshot_id:      params.snapshotId,
      component_key:    kpi.kpi_key,
      component_label:  kpi.label,
      raw_value:        kpi.raw_value,
      normalized_score: kpi.score,
      weight:           kpi.weight,
      weighted_score:   kpi.weighted_score,
      rationale:        kpi.rationale,
      kpi_status:       kpi.status,
    }));
    await supabase.from("score_components").insert(rows);
  } catch (err) {
    console.error("[kpiScoringService] writeScoreComponents failed (non-fatal):", err);
  }
}

/**
 * Write scoring_inputs provenance rows — which facts were used and from what source.
 * Non-fatal.
 */
async function writeScoringInputs(params: {
  entityId: string;
  scoreHistoryId: string | null;
  kpis: KpiScore[];
  factValues: EntityFactValue[];
  factDefIdToKey: Map<string, string>;
  factDefs: { id: string; key: string }[];
}): Promise<void> {
  if (!params.scoreHistoryId) return;
  try {
    const supabase = await createClient();
    const keyToDefId = new Map(params.factDefs.map((fd) => [fd.key, fd.id]));
    const factKeyToValue = new Map<string, EntityFactValue>();
    for (const fv of params.factValues) {
      const key = params.factDefIdToKey.get(fv.fact_definition_id);
      if (key) factKeyToValue.set(key, fv);
    }

    // Collect unique fact keys used by non-missing KPIs
    const usedKeys = new Set<string>();
    for (const kpi of params.kpis) {
      if (kpi.status === "missing") continue;
      for (const fk of KPI_FACT_KEYS[kpi.kpi_key] ?? []) {
        if (factKeyToValue.has(fk)) usedKeys.add(fk);
      }
    }

    const rows = Array.from(usedKeys).map((fk) => {
      const fv = factKeyToValue.get(fk)!;
      const src = fv.value_source_type;
      return {
        entity_id:            params.entityId,
        score_history_id:     params.scoreHistoryId,
        fact_key:             fk,
        fact_definition_id:   keyToDefId.get(fk) ?? null,
        value_used:           fv.value_raw,
        value_source_type:    src,
        source_quality_weight: getSourceQuality(src),
      };
    });

    if (rows.length > 0) await supabase.from("scoring_inputs").insert(rows);
  } catch (err) {
    console.error("[kpiScoringService] writeScoringInputs failed (non-fatal):", err);
  }
}

/**
 * Fetch the last N score history entries for an entity, newest first.
 */
export async function getScoreHistory(
  entityId: string,
  limit = 20
): Promise<ScoreHistoryEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("score_history")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ScoreHistoryEntry[];
}

export type ScoreHistoryEntry = {
  id: string;
  entity_id: string;
  overall_score: number | null;
  overall_score_10: number | null;
  overall_score_100: number | null;
  coverage_pct: number | null;
  kpi_count: number | null;
  missing_count: number | null;
  trigger_type: ScoreTriggerType;
  trigger_reason: string | null;
  changed_fact_key: string | null;
  snapshot_id: string | null;
  // Confidence fields (added in migration 038)
  confidence_score: number | null;       // 0–100: reliability of scoring inputs
  total_facts_used: number | null;
  document_backed_count: number | null;
  manual_count: number | null;
  inferred_count: number | null;
  override_count: number | null;
  created_at: string;
};

// ─── Source quality weights for confidence calculation ────────────────────────
//
// Confidence reflects how much of the score is based on document-backed facts.
// NOT a measure of deal quality — purely input reliability.
//
//   ai_extracted (has snippet/chunk) = 1.0  — direct document evidence
//   user_override                    = 0.8  — human judgment, possibly doc-backed
//   ai_inferred                      = 0.0  — derived estimate, no direct evidence
//   manual (no doc evidence)         = 0.0  — entered without document backing
//   broker_confirmed / imported      = 0.9  — external confirmation
//   system_derived                   = 0.5  — calculated from other facts

const SOURCE_QUALITY: Record<string, number> = {
  ai_extracted:     1.0,
  user_override:    0.8,
  broker_confirmed: 0.9,
  imported:         0.9,
  system_derived:   0.5,
  ai_inferred:      0.0,
};

function getSourceQuality(sourceType: string): number {
  return SOURCE_QUALITY[sourceType] ?? 0.0;
}

// ─── Confidence calculation ───────────────────────────────────────────────────

export type ScoringConfidence = {
  confidence_score: number;         // 0–100
  total_facts_used: number;
  document_backed_count: number;    // ai_extracted
  manual_count: number;             // ai_inferred + no-doc user entries
  inferred_count: number;           // ai_inferred
  override_count: number;           // user_override (all)
};

/**
 * Map from KPI key to the fact keys it consumes.
 * Used to determine which fact values were actually used in scoring.
 */
const KPI_FACT_KEYS: Record<string, string[]> = {
  // V1 Triage — 6 KPIs (business_stability removed; size/stability → Buyer Fit)
  price_multiple:       ["asking_price", "sde_latest", "ebitda_latest"],
  earnings_margin:      ["revenue_latest", "sde_latest", "ebitda_latest"],
  revenue_per_employee: ["revenue_latest", "employees_ft", "employees_pt"],
  rent_ratio:           ["lease_monthly_rent", "revenue_latest"],
  owner_dependence:     ["owner_hours_per_week", "owner_in_sales", "owner_in_operations", "manager_in_place"],
  revenue_quality:      ["recurring_revenue_pct", "customer_concentration_top1_pct"],
};

export function computeScoringConfidence(
  kpis: KpiScore[],
  factValues: EntityFactValue[],
  factDefIdToKey: Map<string, string>
): ScoringConfidence {
  // Build fact key → source type map
  const factKeyToSource = new Map<string, string>();
  for (const fv of factValues) {
    const key = factDefIdToKey.get(fv.fact_definition_id);
    if (key) factKeyToSource.set(key, fv.value_source_type);
  }

  // Collect the unique fact keys actually used by scored (non-missing) KPIs
  const usedFactKeys = new Set<string>();
  for (const kpi of kpis) {
    if (kpi.status === "missing") continue;
    const factKeys = KPI_FACT_KEYS[kpi.kpi_key] ?? [];
    for (const fk of factKeys) {
      if (factKeyToSource.has(fk)) usedFactKeys.add(fk);
    }
  }

  let totalWeight = 0;
  let weightedQuality = 0;
  let documentBackedCount = 0;
  let inferredCount = 0;
  let overrideCount = 0;
  let manualCount = 0;

  for (const fk of usedFactKeys) {
    const src = factKeyToSource.get(fk) ?? "ai_inferred";
    const quality = getSourceQuality(src);
    totalWeight += 1;
    weightedQuality += quality;

    if (src === "ai_extracted") documentBackedCount++;
    else if (src === "ai_inferred") { inferredCount++; manualCount++; }
    else if (src === "user_override") overrideCount++;
    else manualCount++;
  }

  const confidenceScore = totalWeight > 0
    ? Math.round((weightedQuality / totalWeight) * 100)
    : 0;

  return {
    confidence_score: confidenceScore,
    total_facts_used: usedFactKeys.size,
    document_backed_count: documentBackedCount,
    manual_count: manualCount,
    inferred_count: inferredCount,
    override_count: overrideCount,
  };
}

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Score all 12 KPIs from the entity's current fact values.
 * Pure function — no DB writes. Call persistKpiScorecard() to save.
 */
export function computeKpiScorecard(
  factValues: EntityFactValue[],
  factDefIdToKey: Map<string, string>
): KpiScorecardResult {
  // Build typed inputs from fact values
  const rawInputs = extractFactInputs(factValues, factDefIdToKey);

  // Map registry keys to KpiFactInputs shape
  const inputs: KpiFactInputs = {
    asking_price:                    rawInputs.asking_price as number | null ?? null,
    revenue_latest:                  rawInputs.revenue_latest as number | null ?? null,
    sde_latest:                      rawInputs.sde_latest as number | null ?? null,
    ebitda_latest:                   rawInputs.ebitda_latest as number | null ?? null,
    revenue_year_1:                  rawInputs.revenue_year_1 as number | null ?? null,
    revenue_year_2:                  rawInputs.revenue_year_2 as number | null ?? null,
    sde_year_1:                      rawInputs.sde_year_1 as number | null ?? null,
    lease_monthly_rent:              rawInputs.lease_monthly_rent as number | null ?? null,
    years_in_business:               rawInputs.years_in_business as number | null ?? null,
    customer_concentration_top1_pct: rawInputs.customer_concentration_top1_pct as number | null ?? null,
    recurring_revenue_pct:           rawInputs.recurring_revenue_pct as number | null ?? null,
    owner_hours_per_week:            rawInputs.owner_hours_per_week as number | null ?? null,
    manager_in_place:                rawInputs.manager_in_place as boolean | null ?? null,
    owner_in_sales:                  rawInputs.owner_in_sales as boolean | null ?? null,
    owner_in_operations:             rawInputs.owner_in_operations as boolean | null ?? null,
    employees_ft:                    rawInputs.employees_ft as number | null ?? null,
    employees_pt:                    rawInputs.employees_pt as number | null ?? null,
    legal_risk_flag:                 rawInputs.legal_risk_flag as boolean | null ?? null,
    compliance_risk_flag:            rawInputs.compliance_risk_flag as boolean | null ?? null,
    licensing_dependency:            rawInputs.licensing_dependency as boolean | null ?? null,
    capex_intensity:                 rawInputs.capex_intensity as string | null ?? null,
    seasonality:                     rawInputs.seasonality as string | null ?? null,
  };

  // Score each KPI
  const kpis: KpiScore[] = KPI_DEFINITIONS.map((def) => {
    const result = def.score(inputs);
    const weighted_score = result.score !== null ? result.score * def.weight : null;
    return {
      kpi_key: def.kpi_key,
      label: def.label,
      raw_value: result.raw_value,
      score: result.score,
      weight: def.weight,
      weighted_score,
      rationale: result.rationale,
      status: result.status,
    };
  });

  // Compute overall score from non-missing KPIs (re-weight to available KPIs)
  const scoredKpis = kpis.filter((k) => k.score !== null);
  const missingCount = kpis.filter((k) => k.status === "missing").length;

  let overallScore: number | null = null;
  let overallScore100: number | null = null;

  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((sum, k) => sum + k.weight, 0);
    const weightedSum = scoredKpis.reduce((sum, k) => sum + (k.weighted_score ?? 0), 0);
    // Re-normalize to account for missing KPIs; result is natively 0–10
    overallScore = totalWeight > 0 ? weightedSum / totalWeight : null;
    // overall_score_100 = score * 10, used for progress bars
    overallScore100 = overallScore !== null ? Math.round(overallScore * 10) : null;
  }

  const coveragePct = kpis.length > 0
    ? Math.round((scoredKpis.length / kpis.length) * 100)
    : 0;

  return {
    overall_score: overallScore !== null ? Math.round(overallScore * 10) / 10 : null,
    overall_score_100: overallScore100,
    kpis,
    missing_count: missingCount,
    coverage_pct: coveragePct,
  };
}

// ─── Custom fact scoring ──────────────────────────────────────────────────────

/**
 * Normalize a raw fact value to a 0–10 score for custom scoring.
 * Uses the existing KPI scoring functions for facts that map to a KPI,
 * otherwise uses a simple heuristic based on data type.
 */
function scoreFactForCustomScoring(
  factKey: string,
  parsedValue: number | boolean | string | null,
  allInputs: KpiFactInputs
): number | null {
  if (parsedValue === null) return null;

  // For facts that are inputs to existing KPIs, run the relevant KPI scorer
  // and return its score as a proxy for this fact's quality.
  const kpiForFact: Record<string, string> = {
    asking_price:                    "price_multiple",
    sde_latest:                      "price_multiple",
    ebitda_latest:                   "price_multiple",
    revenue_latest:                  "earnings_margin",
    lease_monthly_rent:              "rent_ratio",
    owner_hours_per_week:            "owner_dependence",
    owner_in_sales:                  "owner_dependence",
    owner_in_operations:             "owner_dependence",
    manager_in_place:                "owner_dependence",
    recurring_revenue_pct:           "revenue_quality",
    customer_concentration_top1_pct: "revenue_quality",
    employees_ft:                    "revenue_per_employee",
    employees_pt:                    "revenue_per_employee",
  };

  const kpiKey = kpiForFact[factKey];
  if (kpiKey) {
    const kpiDef = KPI_DEFINITIONS.find((k) => k.kpi_key === kpiKey);
    if (kpiDef) {
      const result = kpiDef.score(allInputs);
      return result.score;
    }
  }

  // Fallback: score booleans (true = 8, false = 4)
  if (typeof parsedValue === "boolean") {
    return parsedValue ? 8 : 4;
  }

  // Fallback: numeric facts — return a neutral 5 (no benchmark available)
  if (typeof parsedValue === "number") return 5;

  return null;
}

/**
 * Compute a scorecard using user-defined custom fact weights.
 * Each selected fact is scored 0–10, then weighted and summed.
 */
export function computeCustomScorecard(
  factValues: EntityFactValue[],
  factDefIdToKey: Map<string, string>,
  customWeights: Record<string, number>
): KpiScorecardResult {
  const rawInputs = extractFactInputs(factValues, factDefIdToKey);

  const inputs: KpiFactInputs = {
    asking_price:                    rawInputs.asking_price as number | null ?? null,
    revenue_latest:                  rawInputs.revenue_latest as number | null ?? null,
    sde_latest:                      rawInputs.sde_latest as number | null ?? null,
    ebitda_latest:                   rawInputs.ebitda_latest as number | null ?? null,
    revenue_year_1:                  rawInputs.revenue_year_1 as number | null ?? null,
    revenue_year_2:                  rawInputs.revenue_year_2 as number | null ?? null,
    sde_year_1:                      rawInputs.sde_year_1 as number | null ?? null,
    lease_monthly_rent:              rawInputs.lease_monthly_rent as number | null ?? null,
    years_in_business:               rawInputs.years_in_business as number | null ?? null,
    customer_concentration_top1_pct: rawInputs.customer_concentration_top1_pct as number | null ?? null,
    recurring_revenue_pct:           rawInputs.recurring_revenue_pct as number | null ?? null,
    owner_hours_per_week:            rawInputs.owner_hours_per_week as number | null ?? null,
    manager_in_place:                rawInputs.manager_in_place as boolean | null ?? null,
    owner_in_sales:                  rawInputs.owner_in_sales as boolean | null ?? null,
    owner_in_operations:             rawInputs.owner_in_operations as boolean | null ?? null,
    employees_ft:                    rawInputs.employees_ft as number | null ?? null,
    employees_pt:                    rawInputs.employees_pt as number | null ?? null,
    legal_risk_flag:                 rawInputs.legal_risk_flag as boolean | null ?? null,
    compliance_risk_flag:            rawInputs.compliance_risk_flag as boolean | null ?? null,
    licensing_dependency:            rawInputs.licensing_dependency as boolean | null ?? null,
    capex_intensity:                 rawInputs.capex_intensity as string | null ?? null,
    seasonality:                     rawInputs.seasonality as string | null ?? null,
  };

  // Only include facts with non-zero weight
  const activeWeights = Object.entries(customWeights).filter(([, w]) => w > 0);

  const kpis: KpiScore[] = activeWeights.map(([factKey, weight]) => {
    const parsedValue = rawInputs[factKey] ?? null;
    const score = scoreFactForCustomScoring(factKey, parsedValue, inputs);
    const weighted_score = score !== null ? score * weight : null;

    // Find a human-readable label from the KPI definitions or use the fact key
    const existingKpi = KPI_DEFINITIONS.find((k) =>
      KPI_FACT_KEYS[k.kpi_key]?.includes(factKey)
    );
    const label = existingKpi?.label ?? factKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      kpi_key: factKey,
      label,
      raw_value: parsedValue !== null ? String(parsedValue) : null,
      score,
      weight,
      weighted_score,
      rationale: score !== null
        ? `${label}: ${parsedValue}`
        : `${label} not available`,
      status: score !== null ? "known" : "missing",
    };
  });

  const scoredKpis = kpis.filter((k) => k.score !== null);
  const missingCount = kpis.filter((k) => k.status === "missing").length;

  let overallScore: number | null = null;
  let overallScore100: number | null = null;

  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((sum, k) => sum + k.weight, 0);
    const weightedSum = scoredKpis.reduce((sum, k) => sum + (k.weighted_score ?? 0), 0);
    overallScore = totalWeight > 0 ? weightedSum / totalWeight : null;
    overallScore100 = overallScore !== null ? Math.round(overallScore * 10) : null;
  }

  const coveragePct = kpis.length > 0
    ? Math.round((scoredKpis.length / kpis.length) * 100)
    : 0;

  return {
    overall_score: overallScore !== null ? Math.round(overallScore * 10) / 10 : null,
    overall_score_100: overallScore100,
    kpis,
    missing_count: missingCount,
    coverage_pct: coveragePct,
  };
}

// ─── DB-integrated scoring ────────────────────────────────────────────────────

/**
 * Compute KPI scorecard for an entity and persist it as an analysis_snapshot.
 * Creates a processing_run record for full pipeline visibility.
 * Writes a score_history row with trigger context.
 * Returns the scorecard result (whether or not persistence succeeded).
 *
 * If the entity has a custom scoring_config in metadata_json, uses that
 * instead of the default 6 hardcoded KPIs.
 */
export async function scoreAndPersistKpis(
  entityId: string,
  entityTypeId: string,
  options?: {
    triggerType?: ScoreTriggerType;
    triggerReason?: string | null;
    changedFactKey?: string | null;
  }
): Promise<KpiScorecardResult> {
  const triggerType = options?.triggerType ?? "system";

  // Create processing_run before starting
  const processingRun = await createProcessingRun({
    entity_id: entityId,
    run_type: "kpi_scoring",
    triggered_by_type: "system",
    prompt_version: "v1",
  }).catch(() => null);
  const runId = processingRun?.id ?? null;

  try {
    if (runId) await updateProcessingRun(runId, { status: "running" }).catch(() => {});

    const supabase = await createClient();

    const [factValues, factDefs, entityRow] = await Promise.all([
      getCurrentFactsForEntity(entityId),
      getFactDefinitionsForEntityType(entityTypeId),
      supabase.from("entities").select("metadata_json").eq("id", entityId).maybeSingle(),
    ]);

    const factDefIdToKey = new Map<string, string>(
      factDefs.map((fd) => [fd.id, fd.key])
    );

    // Check for custom scoring config in entity metadata
    const meta = (entityRow.data?.metadata_json as Record<string, unknown> | null) ?? {};
    const customWeights = (meta.scoring_config as Record<string, number> | null) ?? null;

    const scorecard = customWeights && Object.keys(customWeights).length > 0
      ? computeCustomScorecard(factValues, factDefIdToKey, customWeights)
      : computeKpiScorecard(factValues, factDefIdToKey);

    // Compute confidence based on source provenance of facts used in scoring
    const confidence = computeScoringConfidence(scorecard.kpis, factValues, factDefIdToKey);

    // Persist as analysis_snapshot
    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "kpi_scorecard",
      title: "KPI Scorecard",
      content_json: {
        overall_score: scorecard.overall_score,
        overall_score_100: scorecard.overall_score_100,
        coverage_pct: scorecard.coverage_pct,
        missing_count: scorecard.missing_count,
        kpis: scorecard.kpis,
        confidence,
      },
      model_name: null,
      prompt_version: "v1",
      run_id: runId,
    }).catch((err) => {
      console.error("[kpiScoringService] Failed to persist KPI scorecard:", err);
      return null;
    });

    const snapshotId = (snapshot as { id?: string } | null)?.id ?? null;

    // Write score history with confidence metrics
    const scoreHistoryId = await writeScoreHistory({
      entityId,
      scorecard,
      confidence,
      triggerType,
      triggerReason: options?.triggerReason ?? null,
      changedFactKey: options?.changedFactKey ?? null,
      snapshotId,
    });

    // Write component-level KPI scores (fire-and-forget)
    writeScoreComponents({
      entityId,
      scoreHistoryId,
      snapshotId,
      kpis: scorecard.kpis,
    }).catch(() => {});

    // Write scoring input provenance (fire-and-forget)
    writeScoringInputs({
      entityId,
      scoreHistoryId,
      kpis: scorecard.kpis,
      factValues,
      factDefIdToKey,
      factDefs: factDefs.map((fd) => ({ id: fd.id, key: fd.key })),
    }).catch(() => {});

    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        output_summary_json: {
          overall_score: scorecard.overall_score,
          overall_score_100: scorecard.overall_score_100,
          coverage_pct: scorecard.coverage_pct,
          missing_count: scorecard.missing_count,
          kpi_count: scorecard.kpis.length,
          confidence_score: confidence.confidence_score,
        },
      }).catch(() => {});
    }

    // Log analysis_refreshed event so the timeline shows score updates
    if (scorecard.overall_score !== null) {
      logAnalysisRefreshed(entityId, {
        overall_score: scorecard.overall_score,
        confidence_score: confidence.confidence_score,
        facts_used: confidence.total_facts_used,
        trigger_type: triggerType,
        trigger_reason: options?.triggerReason ?? null,
      }, { runId }).catch(() => {});
    }

    return scorecard;
  } catch (err) {
    console.error("[kpiScoringService] scoreAndPersistKpis failed:", err);

    if (runId) {
      await updateProcessingRun(runId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }

    // Return empty scorecard on failure
    return {
      overall_score: null,
      overall_score_100: null,
      kpis: [],
      missing_count: 0,
      coverage_pct: 0,
    };
  }
}

/**
 * Load the latest persisted KPI scorecard for an entity from analysis_snapshots.
 * Returns null if none exists yet.
 */
export async function getLatestKpiScorecard(
  entityId: string
): Promise<KpiScorecardResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_snapshots")
    .select("content_json")
    .eq("entity_id", entityId)
    .eq("analysis_type", "kpi_scorecard")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.content_json) return null;

  const c = data.content_json as Record<string, unknown>;
  return {
    overall_score:     (c.overall_score as number | null) ?? null,
    overall_score_100: (c.overall_score_100 as number | null) ?? null,
    coverage_pct:      (c.coverage_pct as number) ?? 0,
    missing_count:     (c.missing_count as number) ?? 0,
    kpis:              (c.kpis as KpiScore[]) ?? [],
    confidence:        (c.confidence as KpiScorecardResult["confidence"]) ?? null,
  };
}
