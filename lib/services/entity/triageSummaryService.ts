/**
 * triageSummaryService
 *
 * @deprecated The auto-run triage summary has been replaced by incrementalRevaluationService.
 * This service is retained for backward compatibility (existing triage_summary snapshots
 * in analysis_snapshots are still read by TriageReviewPanel) and for cases where
 * a dedicated lightweight triage pass is explicitly requested.
 *
 * Do NOT call runTriageSummary automatically from the intake pipeline.
 * Use runIncrementalRevaluation instead.
 *
 * Lightweight triage pass that runs immediately after initial fact extraction.
 * Produces a short, grounded, neutral AI summary of what is known so far.
 *
 * Design constraints:
 * - Uses only facts with fact_scope='triage' or is_user_visible_initially=true
 * - Prompt is strictly neutral — no verdicts, no recommendations
 * - Stores result as an analysis_snapshot with type "triage_summary"
 * - Creates a processing_run record for full pipeline visibility
 * - Sets deal.triaged_at (status no longer changed — simplified 3-status model)
 * - Never throws — all errors are logged and swallowed
 */

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentFactsForEntity,
  getTriageFactDefinitions,
  insertAnalysisSnapshot,
  createProcessingRun,
  updateProcessingRun,
} from "@/lib/db/entities";
import { logEntityEvent } from "./entityEventService";
import type { AnalysisSnapshot, FactDefinition } from "@/types/entity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";
const PROMPT_VERSION = "triage-v2";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriageFactStatus = "found" | "missing" | "ambiguous";

export type TriageFact = {
  key: string;
  label: string;
  value: string | null;
  confidence: number | null;
  source: string | null;
  status: TriageFactStatus;
};

export type TriageSummaryContent = {
  summary: string;
  facts: TriageFact[];
  notable_positives: string[];
  notable_concerns: string[];
  missing_facts: string[];
  facts_found: number;
  facts_missing: number;
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildTriagePrompt(
  dealTitle: string,
  factsContext: string,
  missingFactLabels: string[]
): string {
  const missingNote =
    missingFactLabels.length > 0
      ? `\nMissing facts (not yet available): ${missingFactLabels.join(", ")}`
      : "";

  return `You are a neutral deal-intake assistant. Your job is to summarize what is known about a business based only on the facts provided. Do not make recommendations, verdicts, or judgments about whether the deal is worth pursuing.

Business: ${dealTitle}

Known facts:
${factsContext}${missingNote}

Write a short summary (120–180 words) that:
- Describes what kind of business this appears to be
- States the key financial facts that are available
- Notes which important facts are not yet available
- Uses neutral, factual language only
- Does NOT say "this looks like a good deal", "worth pursuing", "pass on this", or any directive language

Also identify up to 3 notable positives (factual observations only, not opinions) and up to 3 notable concerns (factual gaps or flags, not opinions). Keep each item to one short sentence.

Return ONLY valid JSON with this exact structure:
{
  "summary": "string",
  "notable_positives": ["string"],
  "notable_concerns": ["string"]
}`;
}

// ─── Fact builder ─────────────────────────────────────────────────────────────

/**
 * Build the triage fact list from fact definitions and current entity fact values.
 * Uses the DB-driven triage fact set (fact_scope='triage' or is_user_visible_initially=true)
 * rather than a hardcoded key list.
 */
function buildTriageFacts(
  triageFactDefs: FactDefinition[],
  factValueByDefId: Map<string, { value_raw: string | null; status: string; confidence: number | null }>
): TriageFact[] {
  // Sort by display_order (nulls last) so the UI and prompt are stable
  const sorted = [...triageFactDefs].sort((a, b) => {
    if (a.display_order === null && b.display_order === null) return 0;
    if (a.display_order === null) return 1;
    if (b.display_order === null) return -1;
    return a.display_order - b.display_order;
  });

  return sorted.map((def) => {
    const val = factValueByDefId.get(def.id);
    const hasValue = val && val.value_raw && val.status !== "missing";

    return {
      key: def.key,
      label: def.label,
      value: hasValue ? val!.value_raw : null,
      confidence: hasValue ? (val!.confidence ?? null) : null,
      source: null,
      status: !val || val.status === "missing"
        ? "missing"
        : val.status === "unclear" || val.status === "conflicting"
        ? "ambiguous"
        : "found",
    };
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run triage summary for an entity. Stores the result as an analysis_snapshot
 * and updates the deal status to "triaged". Non-fatal.
 *
 * Creates a processing_run record for full pipeline visibility.
 * Uses getTriageFactDefinitions() to load the triage fact set from the DB
 * (fact_scope='triage' or is_user_visible_initially=true) — no hardcoded keys.
 */
export async function runTriageSummary(
  entityId: string,
  entityTypeId: string,
  dealId: string,
  dealTitle: string
): Promise<AnalysisSnapshot | null> {
  // Create processing_run record before starting
  const processingRun = await createProcessingRun({
    entity_id: entityId,
    run_type: "triage_generation",
    triggered_by_type: "upload_event",
    model_name: MODEL,
    prompt_version: PROMPT_VERSION,
  }).catch(() => null);
  const runId = processingRun?.id ?? null;

  try {
    if (runId) await updateProcessingRun(runId, { status: "running" }).catch(() => {});

    const supabase = await createClient();

    // 1. Load triage fact definitions (DB-driven, not hardcoded)
    const [triageFactDefs, currentFacts] = await Promise.all([
      getTriageFactDefinitions(entityTypeId),
      getCurrentFactsForEntity(entityId),
    ]);

    // 2. Build lookup maps
    const factValueByDefId = new Map(
      currentFacts.map((fv) => [fv.fact_definition_id, fv])
    );

    // 3. Build triage fact list
    const triageFacts = buildTriageFacts(triageFactDefs, factValueByDefId);

    const foundFacts = triageFacts.filter((f) => f.status !== "missing");
    const missingFacts = triageFacts.filter((f) => f.status === "missing");

    // 4. Build context strings for the prompt
    const factsContext = foundFacts.length > 0
      ? foundFacts.map((f) => {
          const ambig = f.status === "ambiguous" ? " [ambiguous]" : "";
          return `${f.label}: ${f.value}${ambig}`;
        }).join("\n")
      : "No facts extracted yet.";

    const missingFactLabels = missingFacts.map((f) => f.label);

    // 5. Call AI for the neutral summary
    let summary = "Initial review in progress. Add more information to generate a summary.";
    let notablePositives: string[] = [];
    let notableConcerns: string[] = [];

    if (foundFacts.length > 0) {
      try {
        const response = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: buildTriagePrompt(dealTitle, factsContext, missingFactLabels),
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 600,
        });

        const raw = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        if (typeof parsed.summary === "string" && parsed.summary.trim()) {
          summary = parsed.summary.trim();
        }
        if (Array.isArray(parsed.notable_positives)) {
          notablePositives = (parsed.notable_positives as unknown[])
            .filter((x): x is string => typeof x === "string")
            .slice(0, 3);
        }
        if (Array.isArray(parsed.notable_concerns)) {
          notableConcerns = (parsed.notable_concerns as unknown[])
            .filter((x): x is string => typeof x === "string")
            .slice(0, 3);
        }
      } catch (aiErr) {
        console.error("[triageSummaryService] AI call failed (non-fatal):", aiErr);
      }
    }

    // 6. Build the full content object
    const content: TriageSummaryContent = {
      summary,
      facts: triageFacts,
      notable_positives: notablePositives,
      notable_concerns: notableConcerns,
      missing_facts: missingFactLabels,
      facts_found: foundFacts.length,
      facts_missing: missingFacts.length,
    };

    // 7. Store as analysis_snapshot (linked to processing_run)
    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "triage_summary",
      title: `Initial Review — ${dealTitle}`,
      content_json: content as unknown as Record<string, unknown>,
      model_name: foundFacts.length > 0 ? MODEL : null,
      prompt_version: PROMPT_VERSION,
      run_id: runId,
    });

    // 8. Record triaged_at timestamp (status stays 'active' — simplified status model)
    await supabase
      .from("deals")
      .update({ triaged_at: new Date().toISOString() })
      .eq("id", dealId);

    // 9. Mark processing_run as completed
    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        output_summary_json: {
          snapshot_id: snapshot?.id ?? null,
          facts_found: foundFacts.length,
          facts_missing: missingFacts.length,
          triage_fact_count: triageFacts.length,
        },
      }).catch(() => {});
    }

    // 10. Log the event
    await logEntityEvent(entityId, "triage_completed", {
      facts_found: foundFacts.length,
      facts_missing: missingFacts.length,
      snapshot_id: snapshot?.id ?? null,
    }, undefined, undefined, { runId });

    return snapshot;
  } catch (err) {
    console.error("[triageSummaryService] runTriageSummary failed (non-fatal):", err);

    if (runId) {
      await updateProcessingRun(runId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }

    return null;
  }
}
