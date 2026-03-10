/**
 * swotAnalysisService
 *
 * Generates a SWOT analysis from structured facts only.
 * Never reads raw files or transcripts — only entity_fact_values.
 *
 * Rules:
 *   - Max 4 bullets per SWOT category
 *   - Every bullet must reference a specific fact value
 *   - Neutral tone — no buy/pass recommendations
 *   - Stored as analysis_snapshot with type "swot_analysis"
 *
 * Triggered automatically after any fact change via the post-fact orchestrator.
 */

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  insertAnalysisSnapshot,
  createProcessingRun,
  updateProcessingRun,
} from "@/lib/db/entities";
import type { EntityFactValue, FactDefinition } from "@/types/entity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";
const PROMPT_VERSION = "swot-v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwotBullet = {
  text: string;
  fact_key: string | null;  // which fact this bullet references
};

export type SwotAnalysisContent = {
  strengths:    SwotBullet[];
  weaknesses:   SwotBullet[];
  opportunities: SwotBullet[];
  threats:      SwotBullet[];
  facts_used:   number;
  generated_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFactsSummary(
  factValues: EntityFactValue[],
  factDefs: FactDefinition[]
): string {
  const defMap = new Map(factDefs.map((d) => [d.id, d]));
  const lines: string[] = [];

  for (const fv of factValues) {
    if (!fv.value_raw || fv.status === "missing") continue;
    const def = defMap.get(fv.fact_definition_id);
    if (!def) continue;
    const statusNote = fv.status === "conflicting" ? " [CONFLICTING]"
      : fv.status === "unclear" ? " [UNCLEAR]"
      : "";
    lines.push(`${def.label}: ${fv.value_raw}${statusNote}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No facts available yet.";
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateSwotFromFacts(
  entityId: string,
  entityTypeId: string,
  entityTitle: string
): Promise<SwotAnalysisContent | null> {
  const run = await createProcessingRun({
    entity_id: entityId,
    run_type: "swot_analysis",
    triggered_by_type: "system",
    prompt_version: PROMPT_VERSION,
  }).catch(() => null);
  const runId = run?.id ?? null;

  try {
    if (runId) await updateProcessingRun(runId, { status: "running" }).catch(() => {});

    const [factValues, factDefs] = await Promise.all([
      getCurrentFactsForEntity(entityId),
      getFactDefinitionsForEntityType(entityTypeId),
    ]);

    const filledFacts = factValues.filter(
      (fv) => fv.value_raw && fv.status !== "missing"
    );

    if (filledFacts.length < 2) {
      if (runId) await updateProcessingRun(runId, { status: "skipped", output_summary_json: { reason: "insufficient_facts" } }).catch(() => {});
      return null;
    }

    const factsSummary = buildFactsSummary(factValues, factDefs);

    const systemPrompt = `You are a business acquisition analyst. Generate a concise SWOT analysis for a business acquisition opportunity based ONLY on the structured facts provided. Do not invent or assume any information not present in the facts.

Rules:
- Maximum 4 bullets per category (Strengths, Weaknesses, Opportunities, Threats)
- Every bullet must reference a specific fact value
- Neutral tone — do not recommend buying or passing
- Be specific and quantitative where facts allow
- If a category has no relevant facts, return an empty array for it

Respond with valid JSON only, no markdown, no explanation. Use this exact schema:
{
  "strengths": [{"text": "...", "fact_key": "..."}],
  "weaknesses": [{"text": "...", "fact_key": "..."}],
  "opportunities": [{"text": "...", "fact_key": "..."}],
  "threats": [{"text": "...", "fact_key": "..."}]
}`;

    const userPrompt = `Business: ${entityTitle}

Structured Facts:
${factsSummary}

Generate the SWOT analysis based strictly on these facts.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      strengths?: { text: string; fact_key?: string | null }[];
      weaknesses?: { text: string; fact_key?: string | null }[];
      opportunities?: { text: string; fact_key?: string | null }[];
      threats?: { text: string; fact_key?: string | null }[];
    };

    const normalize = (arr: typeof parsed.strengths): SwotBullet[] =>
      (arr ?? []).slice(0, 4).map((b) => ({
        text: b.text ?? "",
        fact_key: b.fact_key ?? null,
      }));

    const content: SwotAnalysisContent = {
      strengths:     normalize(parsed.strengths),
      weaknesses:    normalize(parsed.weaknesses),
      opportunities: normalize(parsed.opportunities),
      threats:       normalize(parsed.threats),
      facts_used:    filledFacts.length,
      generated_at:  new Date().toISOString(),
    };

    // Persist as analysis_snapshot
    await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "swot_analysis",
      title: "SWOT Analysis",
      content_json: content as unknown as Record<string, unknown>,
      model_name: MODEL,
      prompt_version: PROMPT_VERSION,
      run_id: runId,
    }).catch((err) => {
      console.error("[swotAnalysisService] Failed to persist SWOT snapshot:", err);
    });

    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        model_name: MODEL,
        output_summary_json: {
          strengths: content.strengths.length,
          weaknesses: content.weaknesses.length,
          opportunities: content.opportunities.length,
          threats: content.threats.length,
          facts_used: content.facts_used,
        },
      }).catch(() => {});
    }

    return content;
  } catch (err) {
    console.error("[swotAnalysisService] generateSwotFromFacts failed:", err);
    if (runId) {
      await updateProcessingRun(runId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
    return null;
  }
}

/**
 * Load the latest persisted SWOT analysis for an entity.
 */
export async function getLatestSwotAnalysis(
  entityId: string
): Promise<SwotAnalysisContent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_snapshots")
    .select("content_json")
    .eq("entity_id", entityId)
    .eq("analysis_type", "swot_analysis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.content_json) return null;
  return data.content_json as SwotAnalysisContent;
}
