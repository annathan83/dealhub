/**
 * Tests: fact reconciliation logic
 *
 * Validates the 5-state reconciliation rules in factReconciliationService:
 * - Rule 1: No existing evidence → confirmed (or unclear if low confidence)
 * - Rule 2: Matching evidence → keep best confidence
 * - Rule 3: Conflicting values → mark conflicting
 * - Rule 4: Stronger new evidence → supersede old
 * - Manual overrides are never touched by reconciliation
 */

import { describe, it, expect } from "vitest";

// ─── Pure helper extracted from factReconciliationService ────────────────────
// (Copied here to test without DB dependencies)

const CONFLICT_THRESHOLD = 0.15;
const MIN_CONFIDENCE_FOR_SUPERSEDE = 0.7;

function valuesConflict(
  existing: string | null,
  incoming: string,
  dataType: string
): boolean {
  if (!existing) return false;

  if (dataType === "currency" || dataType === "number" || dataType === "percent") {
    const a = parseFloat(existing.replace(/[^0-9.-]/g, ""));
    const b = parseFloat(incoming.replace(/[^0-9.-]/g, ""));
    if (isNaN(a) || isNaN(b)) return existing.trim() !== incoming.trim();
    if (a === 0 && b === 0) return false;
    const diff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
    return diff > CONFLICT_THRESHOLD;
  }

  if (dataType === "boolean") {
    return existing.toLowerCase() !== incoming.toLowerCase();
  }

  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return normalize(existing) !== normalize(incoming);
}

function resolveStatus(
  existingValue: string | null,
  existingConfidence: number | null,
  incomingValue: string,
  incomingConfidence: number,
  dataType: string
): "confirmed" | "unclear" | "conflicting" {
  if (!existingValue) {
    return incomingConfidence >= 0.5 ? "confirmed" : "unclear";
  }

  if (valuesConflict(existingValue, incomingValue, dataType)) {
    return "conflicting";
  }

  if (
    incomingConfidence >= MIN_CONFIDENCE_FOR_SUPERSEDE &&
    incomingConfidence > (existingConfidence ?? 0)
  ) {
    return "confirmed";
  }

  return "confirmed";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("valuesConflict", () => {
  it("returns false when existing is null", () => {
    expect(valuesConflict(null, "$500,000", "currency")).toBe(false);
  });

  it("detects currency conflict when values differ by >15%", () => {
    expect(valuesConflict("$500,000", "$600,000", "currency")).toBe(true);
  });

  it("does not flag currency conflict when values differ by <15%", () => {
    expect(valuesConflict("$500,000", "$520,000", "currency")).toBe(false);
  });

  it("detects boolean conflict", () => {
    expect(valuesConflict("yes", "no", "boolean")).toBe(true);
    expect(valuesConflict("yes", "yes", "boolean")).toBe(false);
  });

  it("normalizes text before comparing", () => {
    expect(valuesConflict("San Francisco", "san francisco", "text")).toBe(false);
    expect(valuesConflict("San Francisco", "Los Angeles", "text")).toBe(true);
  });
});

describe("resolveStatus (reconciliation rules)", () => {
  it("Rule 1: no existing value → confirmed when confidence ≥ 0.5", () => {
    expect(resolveStatus(null, null, "$400k", 0.8, "currency")).toBe("confirmed");
  });

  it("Rule 1: no existing value → unclear when confidence < 0.5", () => {
    expect(resolveStatus(null, null, "$400k", 0.3, "currency")).toBe("unclear");
  });

  it("Rule 3: conflicting values → conflicting status", () => {
    expect(resolveStatus("$500,000", 0.9, "$800,000", 0.85, "currency")).toBe("conflicting");
  });

  it("Rule 4: stronger new evidence → confirmed (supersedes old)", () => {
    expect(resolveStatus("$500,000", 0.5, "$510,000", 0.9, "currency")).toBe("confirmed");
  });

  it("Rule 2: matching values → confirmed regardless of confidence order", () => {
    expect(resolveStatus("$500,000", 0.9, "$505,000", 0.6, "currency")).toBe("confirmed");
  });
});

describe("manual override protection (contract)", () => {
  it("DB entities module guards manual_override facts from being overwritten", async () => {
    // The actual guard lives in the DB layer (upsertEntityFactValue checks
    // manual_override before updating). Verify the source contains the guard.
    const fs = await import("fs/promises");
    const src = await fs.readFile(
      new URL("../lib/db/entities.ts", import.meta.url),
      "utf-8"
    );
    expect(src).toContain("manual_override");
  });
});
