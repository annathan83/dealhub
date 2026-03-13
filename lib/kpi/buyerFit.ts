/**
 * Buyer Fit Engine
 *
 * Deterministic rule-based analysis of how well a deal matches the buyer's profile.
 *
 * This is SEPARATE from the Deal Score.
 *   Deal Score  = "Is this deal attractive on its own terms?"
 *   Buyer Fit   = "Is this deal attractive for THIS buyer?"
 *
 * Output: High / Medium / Low fit label + short explanation bullets.
 * Pure function — no DB access, no AI.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuyerProfile = {
  preferred_industries?: string[] | null;
  excluded_industries?: string[] | null;
  target_sde_min?: number | null;
  target_sde_max?: number | null;
  target_purchase_price_min?: number | null;
  target_purchase_price_max?: number | null;
  preferred_locations?: string[] | null;
  max_employees?: number | null;
  manager_required?: "yes" | "no" | "prefer" | null;
  owner_operator_ok?: "yes" | "no" | "prefer" | null;
  preferred_business_characteristics?: string | null;
  experience_background?: string | null;
  acquisition_goals?: string | null;
  // Source tracking — set when profile is imported from a document
  updated_at?: string | null;
  profile_source_file_name?: string | null;
  profile_source_drive_file_id?: string | null;
  profile_source_uploaded_at?: string | null;
};

export type DealFacts = {
  industry?: string | null;
  location?: string | null;
  sde?: number | null;
  asking_price?: number | null;
  total_employees?: number | null;
  manager_in_place?: boolean | null;
  owner_hours_per_week?: number | null;
};

export type FitVerdict = "GOOD_FIT" | "FIT" | "PARTIAL_FIT" | "NOT_A_GOOD_FIT";

export type BuyerFitCriterion = {
  name: string;
  matched: boolean;
  context: string;
};

export type BuyerFitResult = {
  verdict: FitVerdict;
  label: string;             // "Good Fit" | "Fit" | "Partial Fit" | "Not a Good Fit"
  shortLabel: string;        // "Good Fit" | "Fit" | "Partial" | "Not a Fit" (for compact UI)
  color: string;
  bgColor: string;
  borderColor: string;
  bullets: string[];         // 2–5 short explanation bullets
  /** Per-criterion results for Analysis tab (only configured criteria) */
  criteria: BuyerFitCriterion[];
  match_count: number;
  mismatch_count: number;
  checked_count: number;
};

// ─── Main function ────────────────────────────────────────────────────────────

export function computeBuyerFit(
  profile: BuyerProfile,
  deal: DealFacts
): BuyerFitResult {
  const matches: string[] = [];
  const mismatches: string[] = [];
  const neutral: string[] = [];
  const criteria: BuyerFitCriterion[] = [];

  // ── Industry fit ─────────────────────────────────────────────────────────────
  if (deal.industry) {
    const dealIndustry = deal.industry.toLowerCase();
    const excluded = profile.excluded_industries ?? [];
    const isExcluded = excluded.some((e) => dealIndustry.includes(e.toLowerCase()) || e.toLowerCase().includes(dealIndustry));
    if (isExcluded) {
      const msg = `Industry (${deal.industry}) is in your excluded list`;
      mismatches.push(msg);
      criteria.push({ name: "Industry", matched: false, context: msg });
    } else {
      const preferred = profile.preferred_industries ?? [];
      if (preferred.length > 0) {
        const isMatch = preferred.some((p) => dealIndustry.includes(p.toLowerCase()) || p.toLowerCase().includes(dealIndustry));
        const msg = isMatch ? `Industry matches your preferences (${deal.industry})` : `Industry (${deal.industry}) is not in your preferred list`;
        if (isMatch) matches.push(msg);
        else neutral.push(msg);
        criteria.push({ name: "Industry", matched: isMatch, context: msg });
      }
    }
  }

  // ── SDE range fit ─────────────────────────────────────────────────────────────
  if (deal.sde != null) {
    const sdeMin = profile.target_sde_min;
    const sdeMax = profile.target_sde_max;
    const sdeFormatted = formatCurrency(deal.sde);

    if (sdeMin != null && sdeMax != null) {
      const inRange = deal.sde >= sdeMin && deal.sde <= sdeMax;
      const msg = inRange ? `SDE of ${sdeFormatted} is within your target range` : deal.sde < sdeMin ? `SDE of ${sdeFormatted} is below your minimum target (${formatCurrency(sdeMin)})` : `SDE of ${sdeFormatted} exceeds your stated maximum (${formatCurrency(sdeMax)})`;
      if (inRange) matches.push(msg);
      else if (deal.sde < sdeMin) mismatches.push(msg);
      else neutral.push(msg);
      criteria.push({ name: "SDE range", matched: inRange, context: msg });
    } else if (sdeMin != null) {
      const ok = deal.sde >= sdeMin;
      const msg = ok ? `SDE of ${sdeFormatted} meets your minimum target` : `SDE of ${sdeFormatted} is below your minimum target (${formatCurrency(sdeMin)})`;
      if (ok) matches.push(msg);
      else mismatches.push(msg);
      criteria.push({ name: "SDE range", matched: ok, context: msg });
    } else if (sdeMax != null) {
      const ok = deal.sde <= sdeMax;
      const msg = ok ? `SDE of ${sdeFormatted} is within your budget range` : `SDE of ${sdeFormatted} is above your stated maximum`;
      if (ok) matches.push(msg);
      else neutral.push(msg);
      criteria.push({ name: "SDE range", matched: ok, context: msg });
    }
  }

  // ── Purchase price fit ────────────────────────────────────────────────────────
  if (deal.asking_price != null) {
    const priceMin = profile.target_purchase_price_min;
    const priceMax = profile.target_purchase_price_max;
    const priceFormatted = formatCurrency(deal.asking_price);
    if (priceMax != null || priceMin != null) {
      const overMax = priceMax != null && deal.asking_price > priceMax;
      const underMin = priceMin != null && deal.asking_price < priceMin;
      const msg = overMax ? `Asking price of ${priceFormatted} exceeds your preferred maximum (${formatCurrency(priceMax!)})` : underMin ? `Asking price of ${priceFormatted} is below your stated minimum` : `Asking price of ${priceFormatted} is within your preferred range`;
      if (overMax) mismatches.push(msg);
      else if (underMin) neutral.push(msg);
      else matches.push(msg);
      criteria.push({ name: "Price range", matched: !overMax && !underMin, context: msg });
    }
  }

  // ── Location fit ──────────────────────────────────────────────────────────────
  if (deal.location) {
    const preferred = profile.preferred_locations ?? [];
    if (preferred.length > 0) {
      const dealLoc = deal.location.toLowerCase();
      const isMatch = preferred.some((l) => dealLoc.includes(l.toLowerCase()) || l.toLowerCase().includes(dealLoc));
      const msg = isMatch ? `Location (${deal.location}) matches your preferences` : `Location (${deal.location}) is outside your preferred areas`;
      if (isMatch) matches.push(msg);
      else neutral.push(msg);
      criteria.push({ name: "Location", matched: isMatch, context: msg });
    }
  }

  // ── Employee count fit ────────────────────────────────────────────────────────
  if (deal.total_employees != null && profile.max_employees != null) {
    const ok = deal.total_employees <= profile.max_employees;
    const msg = ok ? `Employee count (${deal.total_employees}) is within your comfort range` : `Employee count (${deal.total_employees}) may exceed your preferred maximum (${profile.max_employees})`;
    if (ok) matches.push(msg);
    else mismatches.push(msg);
    criteria.push({ name: "Max employees", matched: ok, context: msg });
  }

  // ── Manager required fit ──────────────────────────────────────────────────────
  if (profile.manager_required && profile.manager_required !== "no") {
    if (deal.manager_in_place === true) {
      const msg = "Manager in place — aligns with your preference";
      matches.push(msg);
      criteria.push({ name: "Manager in place", matched: true, context: msg });
    } else if (deal.manager_in_place === false) {
      const msg = profile.manager_required === "yes" ? "No manager in place, which conflicts with your profile" : "No manager in place — you prefer one but it's not required";
      if (profile.manager_required === "yes") mismatches.push(msg);
      else neutral.push(msg);
      criteria.push({ name: "Manager in place", matched: false, context: msg });
    }
  }

  // ── Owner operator fit ────────────────────────────────────────────────────────
  if (profile.owner_operator_ok && deal.owner_hours_per_week != null) {
    const isHeavyOwnerOp = deal.owner_hours_per_week >= 40;
    if (isHeavyOwnerOp && profile.owner_operator_ok === "no") {
      const msg = `Owner works ${deal.owner_hours_per_week}h/week — you prefer not to be an owner-operator`;
      mismatches.push(msg);
      criteria.push({ name: "Owner involvement", matched: false, context: msg });
    } else if (isHeavyOwnerOp && profile.owner_operator_ok === "yes") {
      const msg = "Owner-operator model aligns with your preference";
      matches.push(msg);
      criteria.push({ name: "Owner involvement", matched: true, context: msg });
    }
  }

  // ── Determine verdict ─────────────────────────────────────────────────────────
  const checkedCount = matches.length + mismatches.length + neutral.length;

  let verdict: FitVerdict;
  if (checkedCount === 0) {
    // No profile data to compare against — treat as unknown / partial
    verdict = "PARTIAL_FIT";
  } else if (mismatches.length >= 2) {
    verdict = "NOT_A_GOOD_FIT";
  } else if (mismatches.length === 1 && matches.length === 0) {
    verdict = "NOT_A_GOOD_FIT";
  } else if (mismatches.length === 0 && matches.length >= 3) {
    verdict = "GOOD_FIT";
  } else if (mismatches.length === 0 && matches.length >= 1) {
    verdict = "FIT";
  } else if (mismatches.length === 1 && matches.length >= 2) {
    verdict = "PARTIAL_FIT";
  } else {
    verdict = "PARTIAL_FIT";
  }

  // ── Build bullets (max 5) ─────────────────────────────────────────────────────
  // Priority: mismatches first, then matches, then neutral
  const allBullets = [...mismatches, ...matches, ...neutral];
  const bullets = allBullets.slice(0, 5);

  if (bullets.length === 0) {
    bullets.push("Complete your Buyer Profile in Settings to see personalized fit analysis");
  }

  // ── Styling ───────────────────────────────────────────────────────────────────
  const styling: Record<FitVerdict, { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string }> = {
    GOOD_FIT: {
      label: "Good Fit",
      shortLabel: "Good Fit",
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
    FIT: {
      label: "Fit",
      shortLabel: "Fit",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50/60",
      borderColor: "border-emerald-200",
    },
    PARTIAL_FIT: {
      label: "Partial Fit",
      shortLabel: "Partial",
      color: "text-amber-700",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    NOT_A_GOOD_FIT: {
      label: "Not a Good Fit",
      shortLabel: "Not a Fit",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  };

  return {
    verdict,
    ...styling[verdict],
    bullets,
    criteria,
    match_count: matches.length,
    mismatch_count: mismatches.length,
    checked_count: checkedCount,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
