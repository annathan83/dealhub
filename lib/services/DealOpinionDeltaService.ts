/**
 * DealOpinionDeltaService
 *
 * Pure comparison service — deterministic, no AI calls.
 * Compares two DealOpinion rows and produces a DealOpinionDelta record.
 *
 * Rules:
 *  - from_opinion may be null (first run for a deal)
 *  - All comparisons are field-by-field
 *  - Risk flags are matched by flag text (case-insensitive)
 *  - Missing information items are matched by string equality
 *  - Metric changes only include fields that actually changed
 */

import { createOpinionDelta } from "@/lib/db/opinionDeltas";
import type {
  DealOpinion,
  DealOpinionDelta,
  DealRiskFlag,
  MetricChange,
} from "@/types";

// ─── Metric keys tracked in snapshots ────────────────────────────────────────

const METRIC_KEYS = [
  "asking_price",
  "revenue",
  "sde",
  "ebitda",
  "implied_multiple",
  "revenue_multiple",
  "sde_multiple",
] as const;

type MetricKey = typeof METRIC_KEYS[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeFlag(f: DealRiskFlag): string {
  return f.flag.trim().toLowerCase();
}

function flagsAdded(
  from: DealRiskFlag[],
  to: DealRiskFlag[]
): DealRiskFlag[] {
  const fromSet = new Set(from.map(normalizeFlag));
  return to.filter((f) => !fromSet.has(normalizeFlag(f)));
}

function flagsRemoved(
  from: DealRiskFlag[],
  to: DealRiskFlag[]
): DealRiskFlag[] {
  const toSet = new Set(to.map(normalizeFlag));
  return from.filter((f) => !toSet.has(normalizeFlag(f)));
}

function missingResolved(from: string[], to: string[]): string[] {
  const toSet = new Set(to.map((s) => s.trim().toLowerCase()));
  return from.filter((s) => !toSet.has(s.trim().toLowerCase()));
}

function missingNew(from: string[], to: string[]): string[] {
  const fromSet = new Set(from.map((s) => s.trim().toLowerCase()));
  return to.filter((s) => !fromSet.has(s.trim().toLowerCase()));
}

/**
 * Extract a numeric metric value from an opinion's valuation_context.
 * Falls back to null if not present.
 */
function getMetricFromOpinion(
  opinion: DealOpinion,
  key: MetricKey
): number | null {
  const ctx = opinion.valuation_context;
  if (!ctx) return null;

  // valuation_context stores multiples as strings like "3.2x"
  if (key === "implied_multiple" && ctx.implied_multiple) {
    return parseFloat(ctx.implied_multiple) || null;
  }
  if (key === "revenue_multiple" && ctx.revenue_multiple) {
    return parseFloat(ctx.revenue_multiple) || null;
  }
  if (key === "sde_multiple" && ctx.sde_multiple) {
    return parseFloat(ctx.sde_multiple) || null;
  }

  return null;
}

function computeMetricChanges(
  from: DealOpinion | null,
  to: DealOpinion
): Record<string, MetricChange> {
  const changes: Record<string, MetricChange> = {};

  for (const key of METRIC_KEYS) {
    const before = from ? getMetricFromOpinion(from, key) : null;
    const after = getMetricFromOpinion(to, key);

    // Only record if at least one side is non-null and they differ
    if (before !== after && (before !== null || after !== null)) {
      changes[key] = { before, after };
    }
  }

  return changes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare two opinions and persist a DealOpinionDelta row.
 * @param from  Previous opinion (null for the first run)
 * @param to    Newly created opinion
 * @param triggeringFileIds  deal_files.id values that triggered this re-analysis
 */
export async function generateOpinionDelta(
  from: DealOpinion | null,
  to: DealOpinion,
  triggeringFileIds: string[] = []
): Promise<DealOpinionDelta> {
  const scoreBefore = from?.ai_deal_score ?? null;
  const scoreAfter = to.ai_deal_score ?? null;
  const scoreChange =
    scoreBefore !== null && scoreAfter !== null
      ? scoreAfter - scoreBefore
      : null;

  const verdictBefore = from?.ai_verdict ?? null;
  const verdictAfter = to.ai_verdict ?? null;
  const verdictChanged = verdictBefore !== verdictAfter;

  const fromFlags = from?.risk_flags ?? [];
  const toFlags = to.risk_flags ?? [];

  const fromMissing = from?.missing_information ?? [];
  const toMissing = to.missing_information ?? [];

  return createOpinionDelta({
    deal_id: to.deal_id,
    user_id: to.user_id,
    from_opinion_id: from?.id ?? null,
    to_opinion_id: to.id,
    score_before: scoreBefore,
    score_after: scoreAfter,
    score_change: scoreChange,
    verdict_before: verdictBefore,
    verdict_after: verdictAfter,
    verdict_changed: verdictChanged,
    changed_metrics: computeMetricChanges(from, to),
    added_risks: flagsAdded(fromFlags, toFlags),
    removed_risks: flagsRemoved(fromFlags, toFlags),
    resolved_missing: missingResolved(fromMissing, toMissing),
    new_missing: missingNew(fromMissing, toMissing),
    triggering_file_ids: triggeringFileIds,
  });
}
