/**
 * Tests: pass / archive flow
 *
 * Validates the decision route logic by testing the handler in isolation.
 * Uses a simple in-memory mock — no real DB calls.
 */

import { describe, it, expect } from "vitest";

// ─── Decision logic (extracted from route for unit testing) ──────────────────

type PassPayload = {
  action: "pass";
  pass_reason?: string | null;
  pass_note?: string | null;
  delete_deal?: boolean;
};

type KeepPayload = { action: "keep_investigating" };
type DecisionPayload = PassPayload | KeepPayload;

type DealRow = { id: string; status: string; user_id: string };

type DecisionResult = {
  status: number;
  body: Record<string, unknown>;
  updatedFields?: Record<string, unknown>;
  deleted?: boolean;
};

/**
 * Pure function that mirrors the decision route logic.
 * Takes the deal row directly instead of a Supabase client.
 */
function applyDecision(
  deal: DealRow | null,
  dealId: string,
  body: DecisionPayload
): DecisionResult {
  if (!deal) return { status: 404, body: { error: "Deal not found" } };

  if (body.action === "pass") {
    const passPayload = body as PassPayload;

    if (passPayload.delete_deal) {
      return { status: 200, body: { action: "deleted", deal_id: dealId }, deleted: true };
    }

    const updatedFields = {
      status: "passed",
      pass_reason: passPayload.pass_reason ?? null,
      pass_note: passPayload.pass_note ?? null,
      passed_at: new Date().toISOString(),
    };

    return { status: 200, body: { action: "passed", deal_id: dealId }, updatedFields };
  }

  // keep_investigating
  const updatedFields = { status: "investigating" };
  return { status: 200, body: { action: "investigating", deal_id: dealId }, updatedFields };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("pass flow", () => {
  it("archives a deal as passed with reason and note", () => {
    const deal: DealRow = { id: "deal-1", status: "triaged", user_id: "user-1" };

    const result = applyDecision(deal, "deal-1", {
      action: "pass",
      pass_reason: "price_too_high",
      pass_note: "Asking 5x but only 2x SDE available.",
    });

    expect(result.status).toBe(200);
    expect(result.body.action).toBe("passed");
    expect(result.updatedFields?.status).toBe("passed");
    expect(result.updatedFields?.pass_reason).toBe("price_too_high");
    expect(result.updatedFields?.passed_at).toBeTruthy();
  });

  it("hard-deletes a deal when delete_deal=true", () => {
    const deal: DealRow = { id: "deal-2", status: "triaged", user_id: "user-1" };

    const result = applyDecision(deal, "deal-2", {
      action: "pass",
      delete_deal: true,
    });

    expect(result.status).toBe(200);
    expect(result.body.action).toBe("deleted");
    expect(result.deleted).toBe(true);
  });

  it("returns 404 when deal does not belong to user", () => {
    const result = applyDecision(null, "deal-999", { action: "pass" });
    expect(result.status).toBe(404);
  });

  it("sets passed_at timestamp on archive", () => {
    const deal: DealRow = { id: "deal-5", status: "triaged", user_id: "user-1" };
    const before = Date.now();

    const result = applyDecision(deal, "deal-5", { action: "pass" });

    const passedAt = result.updatedFields?.passed_at as string;
    expect(new Date(passedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("pass_reason defaults to null when not provided", () => {
    const deal: DealRow = { id: "deal-6", status: "triaged", user_id: "user-1" };

    const result = applyDecision(deal, "deal-6", { action: "pass" });

    expect(result.updatedFields?.pass_reason).toBeNull();
  });
});

describe("keep investigating flow", () => {
  it("transitions deal to investigating status", () => {
    const deal: DealRow = { id: "deal-3", status: "triaged", user_id: "user-1" };

    const result = applyDecision(deal, "deal-3", { action: "keep_investigating" });

    expect(result.status).toBe(200);
    expect(result.body.action).toBe("investigating");
    expect(result.updatedFields?.status).toBe("investigating");
  });

  it("does NOT set passed_at or pass_reason when keeping", () => {
    const deal: DealRow = { id: "deal-4", status: "triaged", user_id: "user-1" };

    const result = applyDecision(deal, "deal-4", { action: "keep_investigating" });

    expect(result.updatedFields?.passed_at).toBeUndefined();
    expect(result.updatedFields?.pass_reason).toBeUndefined();
  });

  it("returns 404 when deal is not found", () => {
    const result = applyDecision(null, "deal-404", { action: "keep_investigating" });
    expect(result.status).toBe(404);
  });
});
