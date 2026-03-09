/**
 * Tests: deep analysis is never auto-run on initial intake
 *
 * Validates that:
 * - entityFileService does NOT call runDeepAnalysis automatically
 * - triageSummaryService is the only AI that runs on intake
 * - the /api/deals/[id]/analysis route rejects new/triaged/passed deals
 */

import { describe, it, expect, vi } from "vitest";

// ─── Test 1: entityFileService does not import deepAnalysisOrchestrator ──────

describe("entityFileService auto-run guard", () => {
  it("does not import or call deepAnalysisOrchestrator", async () => {
    // Read the source file as text and verify there is no reference to
    // deepAnalysisOrchestrator or runDeepAnalysisForDeal
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/entityFileService.ts", import.meta.url),
      "utf-8"
    );

    expect(src).not.toContain("deepAnalysisOrchestrator");
    expect(src).not.toContain("runDeepAnalysisForDeal");
    expect(src).not.toContain("deepAnalysisService");
  });

  it("only runs triageSummary automatically (not deepAnalysis or kpiScoring)", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/entityFileService.ts", import.meta.url),
      "utf-8"
    );

    // Triage is allowed to auto-run
    expect(src).toContain("runTriageSummary");

    // These must NOT be called automatically
    expect(src).not.toContain("scoreAndPersistKpis");
    expect(src).not.toContain("refreshAnalysis");
  });
});

// ─── Test 2: /api/deals/[id]/analysis route blocks new/triaged/passed ────────

describe("analysis route status gate", () => {
  it("route source blocks new, triaged, passed, and archived statuses", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../app/api/deals/[id]/analysis/route.ts", import.meta.url),
      "utf-8"
    );

    // All four blocked statuses must be present in the gate
    expect(src).toContain('"new"');
    expect(src).toContain('"triaged"');
    expect(src).toContain('"passed"');
    expect(src).toContain('"archived"');

    // The gate must return a non-2xx response
    expect(src).toContain("422");
  });

  it("route source does NOT auto-trigger on file upload events", async () => {
    const fs = await import("fs/promises");
    // The entries route should not call the analysis route
    const entriesSrc = await fs.readFile(
      new URL("../app/api/deals/[id]/entries/route.ts", import.meta.url),
      "utf-8"
    );
    expect(entriesSrc).not.toContain("/analysis");
    expect(entriesSrc).not.toContain("refreshAnalysis");
    expect(entriesSrc).not.toContain("scoreAndPersistKpis");
  });
});

// ─── Test 3: deep analysis route requires explicit user action ────────────────

describe("deep analysis route guard", () => {
  it("deep analysis route source gates on deal status", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../app/api/deals/[id]/deep-analysis/route.ts", import.meta.url),
      "utf-8"
    );

    // Route must have a status check — either an allowlist or a blocklist
    const hasStatusCheck =
      src.includes("allowedStatuses") ||
      src.includes("blockedStatuses") ||
      src.includes("deal.status");
    expect(hasStatusCheck).toBe(true);

    // Must return a non-2xx when status is not allowed
    expect(src).toMatch(/40[0-9]|42[0-9]/);

    // "passed" must NOT be in the allowed statuses list
    // (it is excluded from the allowlist, so deep analysis is blocked for passed deals)
    const allowedMatch = src.match(/allowedStatuses\s*=\s*\[([^\]]+)\]/);
    if (allowedMatch) {
      expect(allowedMatch[1]).not.toContain('"passed"');
    }
  });

  it("deep analysis is never imported by entityFileService", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/entityFileService.ts", import.meta.url),
      "utf-8"
    );
    expect(src).not.toContain("deep-analysis");
    expect(src).not.toContain("deepAnalysis");
  });
});
