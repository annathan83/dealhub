/**
 * Tests: deep analysis is never auto-run on initial intake
 *
 * Validates that:
 * - entityFileService does NOT call runDeepAnalysis automatically
 * - incrementalRevaluation is the only AI that runs automatically on intake
 * - the /api/deals/[id]/analysis route rejects passed deals
 * - the /api/deals/[id]/deep-analysis route rejects passed deals
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

  it("only runs incremental revaluation automatically (not deepAnalysis or kpiScoring)", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/entityFileService.ts", import.meta.url),
      "utf-8"
    );

    // Incremental revaluation is the only auto-run AI on intake
    expect(src).toContain("runIncrementalRevaluation");

    // These must NOT be called automatically
    expect(src).not.toContain("scoreAndPersistKpis");
    expect(src).not.toContain("refreshAnalysis");
  });
});

// ─── Test 2: /api/deals/[id]/analysis route blocks new/triaged/passed ────────

describe("analysis route status gate", () => {
  it("route source blocks only passed status (simplified 3-status model)", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../app/api/deals/[id]/analysis/route.ts", import.meta.url),
      "utf-8"
    );

    // Only passed is blocked in the simplified model
    expect(src).toContain('"passed"');

    // Old statuses must NOT be in the gate
    expect(src).not.toContain('"new"');
    expect(src).not.toContain('"triaged"');
    expect(src).not.toContain('"archived"');

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

    // Route must have a status check
    const hasStatusCheck =
      src.includes("blockedStatuses") ||
      src.includes("deal.status");
    expect(hasStatusCheck).toBe(true);

    // Must return a non-2xx when status is not allowed
    expect(src).toMatch(/40[0-9]|42[0-9]/);

    // "passed" must be blocked
    expect(src).toContain('"passed"');

    // Old statuses must NOT be in the gate
    expect(src).not.toContain('"triaged"');
    expect(src).not.toContain('"investigating"');
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
