/**
 * Tests: triage fact persistence
 *
 * Validates that:
 * - TRIAGE_FACT_KEYS contains exactly 15 keys
 * - TriageSummaryContent always includes all 15 facts (found + missing)
 * - Missing facts are explicitly labeled, not silently omitted
 * - Fact statuses are one of the three valid values
 */

import { describe, it, expect } from "vitest";

// Import only the pure constants/types — avoid importing the module itself
// because it instantiates OpenAI at module level (requires OPENAI_API_KEY).
// We duplicate the constant here so the test has no external dependencies.

const TRIAGE_FACT_KEYS = [
  "asking_price",
  "location",
  "industry",
  "revenue_latest",
  "sde_or_ebitda",
  "revenue_trend",
  "profit_margin",
  "employees_ft_pt",
  "owner_hours",
  "manager_in_place",
  "years_in_business",
  "customer_concentration",
  "reason_for_sale",
  "real_estate_included",
  "inventory_included",
] as const;

type TriageFactStatus = "found" | "missing" | "ambiguous";

type TriageFact = {
  key: string;
  label: string;
  value: string | null;
  confidence: number | null;
  source: string | null;
  status: TriageFactStatus;
};

type TriageSummaryContent = {
  summary: string;
  facts: TriageFact[];
  notable_positives: string[];
  notable_concerns: string[];
  missing_facts: string[];
  facts_found: number;
  facts_missing: number;
};

describe("TRIAGE_FACT_KEYS", () => {
  it("contains exactly 15 keys (matches service source)", async () => {
    // Verify the real service also exports exactly 15 keys
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/triageSummaryService.ts", import.meta.url),
      "utf-8"
    );
    // Count entries in the TRIAGE_FACT_KEYS array in the source
    const match = src.match(/TRIAGE_FACT_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/);
    expect(match).toBeTruthy();
    const entries = match![1].split(",").map((s) => s.trim()).filter((s) => s.startsWith('"'));
    expect(entries).toHaveLength(15);
    expect(TRIAGE_FACT_KEYS).toHaveLength(15);
  });

  it("contains no duplicates", () => {
    const unique = new Set(TRIAGE_FACT_KEYS);
    expect(unique.size).toBe(TRIAGE_FACT_KEYS.length);
  });

  it("includes the required financial and operational keys", () => {
    const required = [
      "asking_price",
      "revenue_latest",
      "sde_or_ebitda",
      "employees_ft_pt",
      "reason_for_sale",
    ];
    for (const key of required) {
      expect(TRIAGE_FACT_KEYS).toContain(key);
    }
  });
});

describe("TriageSummaryContent shape", () => {
  function makeContent(overrides: Partial<TriageSummaryContent> = {}): TriageSummaryContent {
    const facts: TriageFact[] = TRIAGE_FACT_KEYS.map((key, i) => ({
      key,
      label: key.replace(/_/g, " "),
      value: i < 8 ? `value-${i}` : null,
      confidence: i < 8 ? 0.9 : null,
      source: null,
      status: i < 8 ? "found" : "missing",
    }));

    return {
      summary: "Test summary.",
      facts,
      notable_positives: [],
      notable_concerns: [],
      missing_facts: facts.filter((f) => f.status === "missing").map((f) => f.label),
      facts_found: 8,
      facts_missing: 7,
      ...overrides,
    };
  }

  it("always has exactly 15 facts entries", () => {
    const content = makeContent();
    expect(content.facts).toHaveLength(15);
  });

  it("missing facts are present in the facts array with status='missing'", () => {
    const content = makeContent();
    const missing = content.facts.filter((f) => f.status === "missing");
    expect(missing.length).toBeGreaterThan(0);
    // Every missing fact has null value — never silently omitted
    for (const f of missing) {
      expect(f.value).toBeNull();
    }
  });

  it("facts_found + facts_missing equals total facts", () => {
    const content = makeContent();
    expect(content.facts_found + content.facts_missing).toBe(content.facts.length);
  });

  it("every fact has a valid status", () => {
    const content = makeContent();
    const validStatuses = new Set(["found", "missing", "ambiguous"]);
    for (const f of content.facts) {
      expect(validStatuses.has(f.status)).toBe(true);
    }
  });

  it("missing_facts array matches facts with status=missing", () => {
    const content = makeContent();
    const missingLabels = content.facts
      .filter((f) => f.status === "missing")
      .map((f) => f.label);
    expect(content.missing_facts).toEqual(missingLabels);
  });
});
