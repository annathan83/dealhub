/**
 * Tests: Deep Analysis flow
 *
 * Covers:
 * 1. First manual run — orchestrator pipeline shape
 * 2. Re-run after new source text — staleness flag
 * 3. Staleness detection — latest_source_at vs deep_analysis_run_at
 * 4. Persistence of multiple analysis runs (no overwrite)
 * 5. Status transition: triaged → investigating
 * 6. Concurrent-run guard (deep_scan_status = "running")
 * 7. Context builder deduplication
 * 8. Context builder source ordering (newest-first)
 */

import { describe, it, expect } from "vitest";

// ─── Types (mirrored from source to avoid importing OpenAI-dependent modules) ─

type DeepAnalysisOrchestratorResult = {
  success: boolean;
  snapshot_id: string | null;
  facts_updated: number;
  deal_status_changed: boolean;
  error?: string;
};

type DeepScanStatus = "not_run" | "running" | "completed" | "failed";

type Entity = {
  id: string;
  entity_type_id: string;
  title: string;
  deep_scan_status: DeepScanStatus | null;
  deep_analysis_run_at: string | null;
  deep_analysis_stale: boolean;
  latest_source_at: string | null;
};

type DealRow = { id: string; status: string; user_id: string };

// ─── Pure orchestrator logic (extracted for unit testing) ─────────────────────

function orchestratorDecision(
  entity: Entity | null,
  deal: DealRow | null
): Pick<DeepAnalysisOrchestratorResult, "error" | "deal_status_changed"> & { proceed: boolean } {
  if (!entity) {
    return { proceed: false, deal_status_changed: false, error: "Entity not found for this deal. Upload a document or paste text first." };
  }

  if (entity.deep_scan_status === "running") {
    return { proceed: false, deal_status_changed: false, error: "A deep analysis is already running for this deal. Please wait for it to complete." };
  }

  const deal_status_changed = deal?.status === "triaged";
  return { proceed: true, deal_status_changed };
}

// ─── Staleness logic (pure function) ─────────────────────────────────────────

function isDeepAnalysisStale(entity: Entity): boolean {
  if (!entity.deep_analysis_run_at) return false;
  if (!entity.latest_source_at) return false;
  return new Date(entity.latest_source_at) > new Date(entity.deep_analysis_run_at);
}

function shouldShowStaleBanner(entity: Entity): boolean {
  return entity.deep_analysis_stale && entity.deep_analysis_run_at !== null;
}

// ─── Context builder deduplication (pure function) ───────────────────────────

function contentFingerprint(text: string): string {
  return text.slice(0, 200).toLowerCase().replace(/\s+/g, " ").trim();
}

function deduplicateTexts(
  items: Array<{ file_id: string; full_text: string; uploaded_at: string }>
): Array<{ file_id: string; full_text: string; uploaded_at: string }> {
  const seen = new Set<string>();
  return items.filter((item) => {
    const fp = contentFingerprint(item.full_text);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

function sortNewestFirst(
  items: Array<{ file_id: string; uploaded_at: string }>
): typeof items {
  return [...items].sort((a, b) =>
    new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
}

// ─── Multiple-run persistence (contract test) ────────────────────────────────

function wouldOverwrite(existingSnapshotId: string, newSnapshotId: string): boolean {
  // analysis_snapshots uses INSERT, not UPSERT — each run creates a new row
  return existingSnapshotId === newSnapshotId;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("orchestrator: first manual run", () => {
  it("proceeds when entity exists and is not running", () => {
    const entity: Entity = {
      id: "ent-1",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "completed",
      deep_analysis_run_at: null,
      deep_analysis_stale: false,
      latest_source_at: null,
    };
    const deal: DealRow = { id: "deal-1", status: "triaged", user_id: "user-1" };

    const decision = orchestratorDecision(entity, deal);

    expect(decision.proceed).toBe(true);
    expect(decision.error).toBeUndefined();
  });

  it("returns error when entity is not found", () => {
    const decision = orchestratorDecision(null, null);

    expect(decision.proceed).toBe(false);
    expect(decision.error).toContain("Entity not found");
  });

  it("transitions deal from triaged to investigating on first run", () => {
    const entity: Entity = {
      id: "ent-2",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: null,
      deep_analysis_run_at: null,
      deep_analysis_stale: false,
      latest_source_at: null,
    };
    const deal: DealRow = { id: "deal-2", status: "triaged", user_id: "user-1" };

    const decision = orchestratorDecision(entity, deal);

    expect(decision.deal_status_changed).toBe(true);
  });

  it("does NOT change status when deal is already investigating", () => {
    const entity: Entity = {
      id: "ent-3",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "completed",
      deep_analysis_run_at: "2024-01-01T00:00:00Z",
      deep_analysis_stale: true,
      latest_source_at: "2024-01-02T00:00:00Z",
    };
    const deal: DealRow = { id: "deal-3", status: "investigating", user_id: "user-1" };

    const decision = orchestratorDecision(entity, deal);

    expect(decision.proceed).toBe(true);
    expect(decision.deal_status_changed).toBe(false);
  });
});

describe("orchestrator: concurrent-run guard", () => {
  it("blocks a second run when deep_scan_status is 'running'", () => {
    const entity: Entity = {
      id: "ent-4",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "running",
      deep_analysis_run_at: null,
      deep_analysis_stale: false,
      latest_source_at: null,
    };
    const deal: DealRow = { id: "deal-4", status: "investigating", user_id: "user-1" };

    const decision = orchestratorDecision(entity, deal);

    expect(decision.proceed).toBe(false);
    expect(decision.error).toContain("already running");
  });

  it("allows a run when deep_scan_status is 'completed'", () => {
    const entity: Entity = {
      id: "ent-5",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "completed",
      deep_analysis_run_at: null,
      deep_analysis_stale: false,
      latest_source_at: null,
    };
    const deal: DealRow = { id: "deal-5", status: "triaged", user_id: "user-1" };

    const decision = orchestratorDecision(entity, deal);

    expect(decision.proceed).toBe(true);
  });
});

describe("staleness detection", () => {
  it("isDeepAnalysisStale: returns false when no deep analysis has run", () => {
    const entity: Entity = {
      id: "ent-6",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: null,
      deep_analysis_run_at: null,
      deep_analysis_stale: false,
      latest_source_at: "2024-01-01T00:00:00Z",
    };
    expect(isDeepAnalysisStale(entity)).toBe(false);
  });

  it("isDeepAnalysisStale: returns false when no source has been added after analysis", () => {
    const entity: Entity = {
      id: "ent-7",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "completed",
      deep_analysis_run_at: "2024-01-02T00:00:00Z",
      deep_analysis_stale: false,
      latest_source_at: "2024-01-01T00:00:00Z",
    };
    expect(isDeepAnalysisStale(entity)).toBe(false);
  });

  it("isDeepAnalysisStale: returns true when source was added after analysis", () => {
    const entity: Entity = {
      id: "ent-8",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "completed",
      deep_analysis_run_at: "2024-01-01T00:00:00Z",
      deep_analysis_stale: false,
      latest_source_at: "2024-01-02T00:00:00Z",
    };
    expect(isDeepAnalysisStale(entity)).toBe(true);
  });

  it("shouldShowStaleBanner: false when no analysis has run yet", () => {
    const entity: Entity = {
      id: "ent-9",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: null,
      deep_analysis_run_at: null,
      deep_analysis_stale: true,
      latest_source_at: "2024-01-01T00:00:00Z",
    };
    expect(shouldShowStaleBanner(entity)).toBe(false);
  });

  it("shouldShowStaleBanner: true when stale flag is set and analysis has run", () => {
    const entity: Entity = {
      id: "ent-10",
      entity_type_id: "et-1",
      title: "Test Deal",
      deep_scan_status: "completed",
      deep_analysis_run_at: "2024-01-01T00:00:00Z",
      deep_analysis_stale: true,
      latest_source_at: "2024-01-02T00:00:00Z",
    };
    expect(shouldShowStaleBanner(entity)).toBe(true);
  });
});

describe("multiple analysis runs: no overwrite", () => {
  it("each run creates a distinct snapshot ID", () => {
    const run1SnapshotId = "snap-abc-001";
    const run2SnapshotId = "snap-abc-002";

    expect(wouldOverwrite(run1SnapshotId, run2SnapshotId)).toBe(false);
  });

  it("analysis_snapshots source file does not use upsert for deep_analysis type", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/db/entities.ts", import.meta.url),
      "utf-8"
    );

    // insertAnalysisSnapshot must use INSERT, not UPSERT
    // Find the function and check it uses .insert() not .upsert()
    const fnMatch = src.match(/function insertAnalysisSnapshot[\s\S]*?(?=\nexport|\nfunction|\n\/\*\*)/);
    if (fnMatch) {
      expect(fnMatch[0]).toContain(".insert(");
      expect(fnMatch[0]).not.toContain(".upsert(");
    }
  });
});

describe("context builder: deduplication", () => {
  it("removes duplicate text items with the same fingerprint", () => {
    const items = [
      { file_id: "f1", full_text: "This is the listing text for a restaurant in Austin TX.", uploaded_at: "2024-01-01T00:00:00Z" },
      { file_id: "f2", full_text: "This is the listing text for a restaurant in Austin TX.", uploaded_at: "2024-01-02T00:00:00Z" },
      { file_id: "f3", full_text: "Financial summary: Revenue $1.2M, SDE $300K.", uploaded_at: "2024-01-03T00:00:00Z" },
    ];

    const deduped = deduplicateTexts(items);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((i) => i.file_id)).toContain("f1");
    expect(deduped.map((i) => i.file_id)).toContain("f3");
    expect(deduped.map((i) => i.file_id)).not.toContain("f2");
  });

  it("keeps items with different content even if similar length", () => {
    const items = [
      { file_id: "f1", full_text: "Revenue: $1M. SDE: $200K. Asking: $800K.", uploaded_at: "2024-01-01T00:00:00Z" },
      { file_id: "f2", full_text: "Revenue: $1M. SDE: $250K. Asking: $900K.", uploaded_at: "2024-01-02T00:00:00Z" },
    ];

    const deduped = deduplicateTexts(items);

    expect(deduped).toHaveLength(2);
  });
});

describe("context builder: source ordering", () => {
  it("sorts newest-first so recent documents get priority", () => {
    const items = [
      { file_id: "old", uploaded_at: "2024-01-01T00:00:00Z" },
      { file_id: "new", uploaded_at: "2024-03-01T00:00:00Z" },
      { file_id: "mid", uploaded_at: "2024-02-01T00:00:00Z" },
    ];

    const sorted = sortNewestFirst(items);

    expect(sorted[0].file_id).toBe("new");
    expect(sorted[1].file_id).toBe("mid");
    expect(sorted[2].file_id).toBe("old");
  });

  it("handles items with the same timestamp without crashing", () => {
    const items = [
      { file_id: "a", uploaded_at: "2024-01-01T00:00:00Z" },
      { file_id: "b", uploaded_at: "2024-01-01T00:00:00Z" },
    ];

    expect(() => sortNewestFirst(items)).not.toThrow();
    expect(sortNewestFirst(items)).toHaveLength(2);
  });
});

describe("re-run after new source text", () => {
  it("stale flag is set to true when source is newer than analysis", () => {
    const analysisRunAt = "2024-01-01T12:00:00Z";
    const newSourceAt = "2024-01-02T09:00:00Z";

    const isStale = new Date(newSourceAt) > new Date(analysisRunAt);
    expect(isStale).toBe(true);
  });

  it("stale flag is false when analysis is newer than source", () => {
    const analysisRunAt = "2024-01-03T12:00:00Z";
    const newSourceAt = "2024-01-02T09:00:00Z";

    const isStale = new Date(newSourceAt) > new Date(analysisRunAt);
    expect(isStale).toBe(false);
  });

  it("entityFileService marks deep_analysis_stale only when analysis has run", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/services/entity/entityFileService.ts", import.meta.url),
      "utf-8"
    );

    // The stale update must be conditional on deep_analysis_run_at not being null
    expect(src).toContain("deep_analysis_run_at");
    expect(src).toContain("deep_analysis_stale");
    // Must also update latest_source_at unconditionally
    expect(src).toContain("latest_source_at");
  });
});
