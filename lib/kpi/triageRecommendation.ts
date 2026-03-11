/**
 * triageRecommendation
 *
 * Deterministic triage recommendation engine.
 * Answers the V1 core question: "Should I ask for the NDA?"
 *
 * Three outputs:
 *   REQUEST_NDA   — score is strong enough and no obvious red flag
 *   BORDERLINE    — score is middling or confidence is low
 *   PROBABLY_PASS — score is weak, clearly overpriced, or unit economics are poor
 *
 * This is a triage opinion, not investment advice.
 * It is intentionally short and fast.
 */

import type { KpiScorecardResult, KpiScore } from "./kpiConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriageVerdict = "REQUEST_NDA" | "BORDERLINE" | "PROBABLY_PASS";

export type TriageRecommendation = {
  verdict: TriageVerdict;
  label: string;           // short display label
  color: string;           // tailwind text color
  bgColor: string;         // tailwind bg color
  borderColor: string;     // tailwind border color
  opinion: string;         // 2–4 sentence explanation
  flags: string[];         // specific concerns or positives that drove the verdict
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getKpi(kpis: KpiScore[], key: string): KpiScore | undefined {
  return kpis.find((k) => k.kpi_key === key);
}

function getScore(kpis: KpiScore[], key: string): number | null {
  return getKpi(kpis, key)?.score ?? null;
}

function getRawValue(kpis: KpiScore[], key: string): string | null {
  return getKpi(kpis, key)?.raw_value ?? null;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Compute a triage recommendation from a KPI scorecard.
 * Pure function — no DB access.
 */
export function computeTriageRecommendation(
  scorecard: KpiScorecardResult
): TriageRecommendation {
  const { overall_score, kpis, coverage_pct } = scorecard;
  const confidence = scorecard.confidence?.confidence_score ?? null;

  // ── Hard pass conditions ─────────────────────────────────────────────────────
  // These override the overall score regardless of other factors.

  const multipleScore = getScore(kpis, "price_multiple");
  const multipleRaw = getRawValue(kpis, "price_multiple");
  const marginScore = getScore(kpis, "earnings_margin");
  const marginRaw = getRawValue(kpis, "earnings_margin");

  const hardPassFlags: string[] = [];

  // Multiple score ≤ 2 (>6x) is a hard pass signal
  if (multipleScore !== null && multipleScore <= 2) {
    hardPassFlags.push(`Very high asking multiple (${multipleRaw ?? "unknown"}) — difficult to justify returns`);
  }

  // Margin score ≤ 2 (<6%) is a hard pass signal
  if (marginScore !== null && marginScore <= 2) {
    hardPassFlags.push(`Very thin SDE margin (${marginRaw ?? "unknown"}) — limited buffer for debt service or surprises`);
  }

  // ── Score-based thresholds ───────────────────────────────────────────────────

  const score = overall_score ?? 0;
  const lowCoverage = coverage_pct < 40; // fewer than 40% of KPIs have data
  const lowConfidence = confidence !== null && confidence < 30;

  // ── Build flags list ─────────────────────────────────────────────────────────

  const positiveFlags: string[] = [];
  const cautionFlags: string[] = [];

  if (multipleScore !== null && multipleScore >= 8) {
    positiveFlags.push(`Attractive asking multiple (${multipleRaw ?? ""})`);
  } else if (multipleScore !== null && multipleScore >= 6) {
    positiveFlags.push(`Reasonable asking multiple (${multipleRaw ?? ""})`);
  }

  if (marginScore !== null && marginScore >= 8) {
    positiveFlags.push(`Strong margin (${marginRaw ?? ""})`);
  } else if (marginScore !== null && marginScore <= 4) {
    cautionFlags.push(`Thin margin (${marginRaw ?? ""}) — validate add-backs`);
  }

  const ownerScore = getScore(kpis, "owner_dependence");
  const ownerRaw = getRawValue(kpis, "owner_dependence");
  if (ownerScore !== null && ownerScore <= 4) {
    cautionFlags.push(`${ownerRaw ?? "High"} owner dependence — transition risk`);
  }

  const rpeScore = getScore(kpis, "revenue_per_employee");
  const rpeRaw = getRawValue(kpis, "revenue_per_employee");
  if (rpeScore !== null && rpeScore >= 8) {
    positiveFlags.push(`Efficient business (${rpeRaw ?? ""} per employee)`);
  }

  const rentScore = getScore(kpis, "rent_ratio");
  const rentRaw = getRawValue(kpis, "rent_ratio");
  if (rentScore !== null && rentScore <= 4) {
    cautionFlags.push(`High rent ratio (${rentRaw ?? ""}) — significant fixed-cost exposure`);
  }

  const revenueQualityScore = getScore(kpis, "revenue_quality");
  const revenueQualityRaw = getRawValue(kpis, "revenue_quality");
  if (revenueQualityScore !== null && revenueQualityScore <= 4) {
    cautionFlags.push(`Revenue quality concern — ${revenueQualityRaw ?? "check concentration or recurring %"}`);
  } else if (revenueQualityScore !== null && revenueQualityScore >= 8) {
    positiveFlags.push(`Strong revenue quality (${revenueQualityRaw ?? ""})`);
  }

  if (lowCoverage) {
    cautionFlags.push("Limited data — score based on partial information");
  }

  if (lowConfidence) {
    cautionFlags.push("Most inputs are manual or inferred — verify with documents");
  }

  // ── Determine verdict ────────────────────────────────────────────────────────

  let verdict: TriageVerdict;

  if (hardPassFlags.length >= 2) {
    // Two or more hard-pass signals → probably pass
    verdict = "PROBABLY_PASS";
  } else if (hardPassFlags.length === 1 && score < 5) {
    // One hard-pass signal + weak score → probably pass
    verdict = "PROBABLY_PASS";
  } else if (score >= 6.5 && hardPassFlags.length === 0 && !lowCoverage) {
    // Strong score, no hard flags, reasonable coverage → request NDA
    verdict = "REQUEST_NDA";
  } else if (score >= 5.5 && hardPassFlags.length === 0) {
    // Decent score, no hard flags → request NDA but note caveats
    verdict = "REQUEST_NDA";
  } else if (score < 4.0 && hardPassFlags.length > 0) {
    verdict = "PROBABLY_PASS";
  } else {
    // Everything else → borderline
    verdict = "BORDERLINE";
  }

  // ── Build opinion text ───────────────────────────────────────────────────────

  const opinion = buildOpinion(verdict, score, positiveFlags, cautionFlags, hardPassFlags, lowCoverage, lowConfidence, multipleRaw, marginRaw);

  // ── Verdict styling ──────────────────────────────────────────────────────────

  const styling: Record<TriageVerdict, { label: string; color: string; bgColor: string; borderColor: string }> = {
    REQUEST_NDA: {
      label: "Request NDA",
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
    BORDERLINE: {
      label: "Borderline",
      color: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    PROBABLY_PASS: {
      label: "Probably Pass",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  };

  const allFlags = verdict === "PROBABLY_PASS"
    ? [...hardPassFlags, ...cautionFlags]
    : verdict === "REQUEST_NDA"
    ? [...positiveFlags, ...cautionFlags]
    : [...cautionFlags, ...positiveFlags];

  return {
    verdict,
    ...styling[verdict],
    opinion,
    flags: allFlags.slice(0, 4), // max 4 flags shown
  };
}

// ─── Opinion builder ──────────────────────────────────────────────────────────

function buildOpinion(
  verdict: TriageVerdict,
  score: number,
  positiveFlags: string[],
  cautionFlags: string[],
  hardPassFlags: string[],
  lowCoverage: boolean,
  lowConfidence: boolean,
  multipleRaw: string | null,
  marginRaw: string | null
): string {
  const scoreStr = score.toFixed(1);

  if (verdict === "REQUEST_NDA") {
    const opening = score >= 7
      ? `This listing looks worth pursuing to NDA (score ${scoreStr}/10).`
      : `This listing is worth a closer look (score ${scoreStr}/10).`;

    const positiveNote = positiveFlags.length > 0
      ? ` ${positiveFlags[0]}.`
      : multipleRaw ? ` The asking multiple of ${multipleRaw} appears reasonable.` : "";

    const cautionNote = cautionFlags.length > 0
      ? ` The NDA should focus on validating ${cautionFlags.map((f) => f.toLowerCase().split(" — ")[0]).join(" and ")}.`
      : " Review the financials carefully before proceeding.";

    const dataNote = lowCoverage || lowConfidence
      ? " Score is based on limited data — more documents will sharpen the picture."
      : "";

    return `${opening}${positiveNote}${cautionNote}${dataNote}`.trim();
  }

  if (verdict === "BORDERLINE") {
    const opening = `This deal is borderline at this stage (score ${scoreStr}/10).`;

    const mainConcern = cautionFlags.length > 0
      ? ` Key concern: ${cautionFlags[0].toLowerCase()}.`
      : hardPassFlags.length > 0
      ? ` ${hardPassFlags[0]}.`
      : "";

    const dataNote = lowCoverage
      ? " The score is based on limited data — upload financials to get a clearer picture before deciding."
      : " Gather more information before committing to the NDA process.";

    return `${opening}${mainConcern}${dataNote}`.trim();
  }

  // PROBABLY_PASS
  const opening = `This listing does not look compelling at this stage (score ${scoreStr}/10).`;

  const mainReason = hardPassFlags.length > 0
    ? ` ${hardPassFlags[0]}.`
    : cautionFlags.length > 0
    ? ` Primary concern: ${cautionFlags[0].toLowerCase()}.`
    : "";

  const closing = " Pass unless the seller can provide a compelling explanation.";

  return `${opening}${mainReason}${closing}`.trim();
}
