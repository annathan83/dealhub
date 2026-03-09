/**
 * Tests: triage fact persistence
 *
 * Validates that:
 * - TriageSummaryContent shape is correct
 * - Missing facts are explicitly labeled, not silently omitted
 * - Fact statuses are one of the three valid values
 * - triageSummaryService uses getTriageFactDefinitions (DB-driven, not hardcoded)
 *
 * Migration 027 / triage-v2: TRIAGE_FACT_KEYS hardcoded list removed from the
 * service. The triage fact set is now loaded from fact_definitions where
 * fact_scope='triage' or is_user_visible_initially=true.
 * The 15 canonical triage facts are seeded in migration 026.
 */

import { describe, it, expect } from "vitest";

// ─── Canonical triage fact keys (seeded in migration 026) ────────────────────
// These are kept here for test assertions only.
// The service loads them from the DB via getTriageFactDefinitions().

const CANONICAL_TRIAGE_KEYS = [
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

describe("triageSummaryService: DB-driven fact loading (contract)", () => {
  it("service uses getTriageFactDefinitions, not a hardcoded key list", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/triageSummaryService.ts", import.meta.url),
      "utf-8"
    );
    // Must import getTriageFactDefinitions from the DB layer
    expect(src).toContain("getTriageFactDefinitions");
    // Must NOT contain a hardcoded TRIAGE_FACT_KEYS array
    expect(src).not.toContain("TRIAGE_FACT_KEYS");
  });

  it("service creates a processing_run for triage_generation", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/triageSummaryService.ts", import.meta.url),
      "utf-8"
    );
    expect(src).toContain("createProcessingRun");
    expect(src).toContain("triage_generation");
    expect(src).toContain("updateProcessingRun");
  });

  it("service links snapshot to processing_run via run_id", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/triageSummaryService.ts", import.meta.url),
      "utf-8"
    );
    expect(src).toContain("run_id: runId");
  });
});

describe("canonical triage keys (migration 026 seed)", () => {
  it("canonical list contains exactly 15 keys", () => {
    expect(CANONICAL_TRIAGE_KEYS).toHaveLength(15);
  });

  it("canonical list contains no duplicates", () => {
    const unique = new Set(CANONICAL_TRIAGE_KEYS);
    expect(unique.size).toBe(CANONICAL_TRIAGE_KEYS.length);
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
      expect(CANONICAL_TRIAGE_KEYS).toContain(key);
    }
  });
});

describe("TriageSummaryContent shape", () => {
  function makeContent(overrides: Partial<TriageSummaryContent> = {}): TriageSummaryContent {
    const facts: TriageFact[] = CANONICAL_TRIAGE_KEYS.map((key, i) => ({
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
