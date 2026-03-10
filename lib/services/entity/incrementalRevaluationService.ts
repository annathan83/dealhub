/**
 * incrementalRevaluationService
 *
 * Runs an efficient incremental re-analysis whenever a meaningful change occurs:
 *   - new file uploaded and extracted
 *   - structured fact added or updated
 *   - AI memory added or updated
 *   - user override applied
 *   - manual refresh requested
 *
 * Unlike Deep Scan (which resends the full text corpus), incremental revaluation:
 *   1. Reads only the latest extracted content (newest file_texts)
 *   2. Reads current structured facts and AI memories
 *   3. Sends a focused "what changed, what does it mean" prompt to AI
 *   4. Stores result as analysis_snapshot (type: 'revaluation')
 *   5. Updates entity.last_revaluation_at and clears entity.revaluation_stale
 *
 * This is the default/normal analysis path. Deep Scan is separate and explicit.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getEntityByLegacyDealId,
  createProcessingRun,
  updateProcessingRun,
  insertAnalysisSnapshot,
} from "@/lib/db/entities";
import { logEntityEvent } from "./entityEventService";
import { getActiveMemories } from "../ai_memories/aiMemoryService";
import { getRecentFactHistory } from "../facts/factHistoryService";

const MODEL = "gpt-4o-mini";
const PROMPT_VERSION = "incremental_revaluation_v1";
const MAX_TEXT_CHARS = 12_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RevaluationTrigger =
  | "file_upload"
  | "extraction_complete"
  | "fact_change"
  | "user_override"
  | "manual_refresh"
  | "deep_scan_complete";

export type RevaluationResult = {
  success: boolean;
  snapshot_id: string | null;
  run_id: string | null;
  changes_detected: number;
  error?: string;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run incremental revaluation for a deal (identified by legacy deal ID).
 * Safe to call after any meaningful change — efficient, low token cost.
 */
export async function runIncrementalRevaluationForDeal(
  dealId: string,
  userId: string,
  trigger: RevaluationTrigger = "manual_refresh"
): Promise<RevaluationResult> {
  const result: RevaluationResult = {
    success: false,
    snapshot_id: null,
    run_id: null,
    changes_detected: 0,
  };

  try {
    const supabase = await createClient();

    // ── 1. Resolve entity ────────────────────────────────────────────────────
    const entity = await getEntityByLegacyDealId(dealId, userId);
    if (!entity) {
      result.error = "Entity not found for this deal.";
      return result;
    }

    return await runIncrementalRevaluation(entity.id, entity.title, trigger, result);
  } catch (err) {
    console.error("[incrementalRevaluationService] runIncrementalRevaluationForDeal failed:", err);
    result.error = err instanceof Error ? err.message : "Unknown error";
    return result;
  }
}

/**
 * Run incremental revaluation for an entity (by entity ID directly).
 * Used internally after file processing completes.
 */
export async function runIncrementalRevaluation(
  entityId: string,
  entityTitle: string,
  trigger: RevaluationTrigger = "manual_refresh",
  _result?: RevaluationResult
): Promise<RevaluationResult> {
  const result: RevaluationResult = _result ?? {
    success: false,
    snapshot_id: null,
    run_id: null,
    changes_detected: 0,
  };

  try {
    const supabase = await createClient();

    // ── 2. Create processing_run record ─────────────────────────────────────
    const processingRun = await createProcessingRun({
      entity_id: entityId,
      run_type: "incremental_revaluation",
      triggered_by_type: trigger === "manual_refresh" ? "user" : "upload_event",
    });
    const runId = processingRun?.id ?? null;
    result.run_id = runId;

    if (runId) {
      await updateProcessingRun(runId, { status: "running" });
    }

    // ── 3. Gather current context ────────────────────────────────────────────
    // Fetch latest extracted text (most recent file_texts per entity)
    const { data: fileTexts } = await supabase
      .from("file_texts")
      .select("full_text, text_type, extracted_at, file_id")
      .eq("extraction_status", "done")
      .in(
        "file_id",
        (
          await supabase
            .from("entity_files")
            .select("id")
            .eq("entity_id", entityId)
        ).data?.map((f: { id: string }) => f.id) ?? []
      )
      .order("extracted_at", { ascending: false })
      .limit(10);

    // Fetch current structured facts
    const { data: factValues } = await supabase
      .from("entity_fact_values")
      .select(`
        value_raw,
        status,
        value_source_type,
        updated_at,
        fact_definitions ( key, label, category )
      `)
      .eq("entity_id", entityId)
      .neq("status", "missing")
      .order("updated_at", { ascending: false })
      .limit(40);

    // Fetch active AI memories
    const memories = await getActiveMemories(entityId);

    // Fetch recent changes (since last revaluation)
    const { data: entityRow } = await supabase
      .from("entities")
      .select("last_revaluation_at, title")
      .eq("id", entityId)
      .single();

    const lastRevaluationAt = entityRow?.last_revaluation_at ?? null;
    const recentChanges = await getRecentFactHistory(entityId, lastRevaluationAt ?? undefined, 20);
    result.changes_detected = recentChanges.length;

    // ── 4. Build prompt ──────────────────────────────────────────────────────
    const textCorpus = (fileTexts ?? [])
      .map((ft: { full_text: string | null; text_type: string }) => ft.full_text ?? "")
      .filter(Boolean)
      .join("\n\n---\n\n")
      .slice(0, MAX_TEXT_CHARS);

    const factsText = (factValues ?? [])
      .map((fv: { fact_definitions: unknown; value_raw: string | null; status: string; value_source_type: string }) => {
        const def = Array.isArray(fv.fact_definitions) ? fv.fact_definitions[0] : fv.fact_definitions;
        const label = (def as { label?: string } | null)?.label ?? "Unknown";
        return `${label}: ${fv.value_raw ?? "unknown"} (${fv.status}, source: ${fv.value_source_type})`;
      })
      .join("\n");

    const memoriesText = memories
      .map((m) => `[${m.memory_type.toUpperCase()}] ${m.memory_text}`)
      .join("\n");

    const changesText = recentChanges.length > 0
      ? recentChanges
          .map((c) => `${c.action} ${c.record_type} (${c.reason ?? "no reason"})`)
          .join("\n")
      : "No tracked changes since last revaluation.";

    const prompt = buildIncrementalPrompt({
      entityTitle,
      textCorpus,
      factsText,
      memoriesText,
      changesText,
      lastRevaluationAt,
    });

    // ── 5. Call AI ───────────────────────────────────────────────────────────
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a deal intelligence assistant. Analyze business acquisition deals based on available evidence. Be concise, factual, and grounded. Do not speculate beyond the evidence.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw_response: raw };
    }

    // ── 6. Store analysis snapshot ───────────────────────────────────────────
    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "revaluation",
      title: `Revaluation — ${entityTitle}`,
      content_json: {
        ...parsed,
        trigger,
        changes_detected: result.changes_detected,
        last_revaluation_at: lastRevaluationAt,
      },
      model_name: MODEL,
      prompt_version: PROMPT_VERSION,
      run_id: runId,
    });
    result.snapshot_id = snapshot?.id ?? null;

    // ── 7. Update entity revaluation timestamps ──────────────────────────────
    await supabase
      .from("entities")
      .update({
        last_revaluation_at: new Date().toISOString(),
        revaluation_stale: false,
      })
      .eq("id", entityId);

    // ── 8. Mark processing_run completed ────────────────────────────────────
    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        output_summary_json: {
          snapshot_id: snapshot?.id ?? null,
          trigger,
          changes_detected: result.changes_detected,
        },
      });
    }

    // ── 9. Log event ─────────────────────────────────────────────────────────
    await logEntityEvent(
      entityId,
      "revaluation_completed",
      { trigger, snapshot_id: snapshot?.id ?? null, changes_detected: result.changes_detected },
      undefined,
      undefined,
      { runId }
    );

    result.success = true;
    return result;
  } catch (err) {
    console.error("[incrementalRevaluationService] runIncrementalRevaluation failed:", err);
    result.error = err instanceof Error ? err.message : "Unknown error";

    if (result.run_id) {
      const supabase = await createClient();
      await updateProcessingRun(result.run_id, {
        status: "failed",
        error_message: result.error,
      }).catch(() => {});
    }

    return result;
  }
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildIncrementalPrompt(params: {
  entityTitle: string;
  textCorpus: string;
  factsText: string;
  memoriesText: string;
  changesText: string;
  lastRevaluationAt: string | null;
}): string {
  const { entityTitle, textCorpus, factsText, memoriesText, changesText, lastRevaluationAt } = params;
  const since = lastRevaluationAt
    ? `since ${new Date(lastRevaluationAt).toLocaleDateString()}`
    : "no previous revaluation";

  return `You are reviewing a business acquisition deal: "${entityTitle}"

RECENT CHANGES (${since}):
${changesText}

CURRENT STRUCTURED FACTS:
${factsText || "No facts extracted yet."}

AI MEMORIES (contextual observations):
${memoriesText || "No memories recorded yet."}

LATEST SOURCE MATERIAL (excerpt):
${textCorpus || "No source material available yet."}

Based on all available information, provide an incremental revaluation in JSON format:

{
  "summary": "2-3 sentence current state of the deal",
  "what_changed": "What new information or changes are most significant",
  "key_risks": ["risk 1", "risk 2"],
  "key_strengths": ["strength 1", "strength 2"],
  "missing_critical_info": ["missing item 1", "missing item 2"],
  "recommended_next_questions": ["question 1", "question 2"],
  "overall_signal": "positive | neutral | negative | insufficient_data",
  "confidence": 0.0
}

Be concise. Focus on what changed and what it means. Do not repeat facts already known unless they are newly significant.`;
}
