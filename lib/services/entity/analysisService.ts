/**
 * analysisService
 *
 * Replaces the aggregateDealIntelligence() stub.
 * Reads entity_fact_values + recent entity_events to build a compact context
 * (not raw files), calls GPT-4o-mini, and inserts an analysis_snapshot.
 *
 * This is non-fatal — if it fails, the legacy opinion system still works.
 */

import OpenAI from "openai";
import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  getEntityHistory,
  insertAnalysisSnapshot,
} from "@/lib/db/entities";
import { logAnalysisRefreshed } from "./entityEventService";
import type { AnalysisSnapshot } from "@/types/entity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";
const PROMPT_VERSION = "v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalysisOutput = {
  summary: string;
  risk_flags: string[];
  missing_information: string[];
  broker_questions: string[];
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(
  entityTitle: string,
  factsContext: string,
  recentEvents: string
): string {
  return `You are a neutral business acquisition analyst. Summarize what is known about this business based only on the facts provided. Do not make buy/pass recommendations.

Business: ${entityTitle}

Known Facts:
${factsContext}

Recent Activity:
${recentEvents}

Provide a JSON response with this exact structure:
{
  "summary": "<2-3 sentence neutral factual summary of the deal based only on available data>",
  "risk_flags": ["<risk 1>", "<risk 2>"],
  "missing_information": ["<missing item 1>", "<missing item 2>"],
  "broker_questions": ["<question 1>", "<question 2>", "<question 3>"]
}

Keep risk_flags to the top 3-5 most important. Keep broker_questions to 3-5 most impactful questions. Do not include scores, verdicts, or buy/pass language.`;
}

// ─── Context builders ─────────────────────────────────────────────────────────

async function buildFactsContext(
  entityId: string,
  entityTypeId: string
): Promise<string> {
  const [factValues, factDefs] = await Promise.all([
    getCurrentFactsForEntity(entityId),
    getFactDefinitionsForEntityType(entityTypeId),
  ]);

  const defById = new Map(factDefs.map((fd) => [fd.id, fd]));
  const lines: string[] = [];

  for (const val of factValues) {
    if (val.status === "missing") continue;
    const def = defById.get(val.fact_definition_id);
    if (!def) continue;

    const statusNote = val.status === "conflicting" ? " [CONFLICTING]"
      : val.status === "unclear" ? " [UNCLEAR]"
      : val.status === "estimated" ? " [ESTIMATED]"
      : "";

    lines.push(`${def.label}: ${val.value_raw ?? "unknown"}${statusNote}`);
  }

  // Note missing critical facts
  const missingCritical = factDefs.filter((fd) => {
    if (!fd.is_critical) return false;
    const val = factValues.find((v) => v.fact_definition_id === fd.id);
    return !val || val.status === "missing";
  });

  if (missingCritical.length > 0) {
    lines.push(`\nMissing critical facts: ${missingCritical.map((fd) => fd.label).join(", ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No facts extracted yet.";
}

async function buildEventsContext(entityId: string): Promise<string> {
  const events = await getEntityHistory(entityId, 20);
  if (events.length === 0) return "No recent activity.";

  return events
    .slice(0, 10)
    .map((ev) => {
      const date = new Date(ev.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `${date}: ${ev.event_type.replace(/_/g, " ")}`;
    })
    .join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a full deal assessment for the entity and store the result as an
 * analysis_snapshot. Returns the snapshot or null on failure.
 */
export async function refreshAnalysis(
  entityId: string,
  entityTypeId: string,
  entityTitle: string
): Promise<AnalysisSnapshot | null> {
  try {
    const [factsContext, eventsContext] = await Promise.all([
      buildFactsContext(entityId, entityTypeId),
      buildEventsContext(entityId),
    ]);

    const prompt = buildAnalysisPrompt(entityTitle, factsContext, eventsContext);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500,
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let output: AnalysisOutput;

    try {
      const parsed = JSON.parse(rawContent) as Record<string, unknown>;
      output = {
        summary: typeof parsed.summary === "string" ? parsed.summary : "Analysis complete.",
        risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags as string[] : [],
        missing_information: Array.isArray(parsed.missing_information) ? parsed.missing_information as string[] : [],
        broker_questions: Array.isArray(parsed.broker_questions) ? parsed.broker_questions as string[] : [],
      };
    } catch {
      console.error("[analysisService] Failed to parse GPT response:", rawContent.slice(0, 200));
      return null;
    }

    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "deal_assessment",
      title: `Deal Assessment — ${entityTitle}`,
      content_json: {
        summary: output.summary,
        risk_flags: output.risk_flags,
        missing_information: output.missing_information,
        broker_questions: output.broker_questions,
        input_tokens: response.usage?.prompt_tokens ?? null,
        output_tokens: response.usage?.completion_tokens ?? null,
      },
      model_name: MODEL,
      prompt_version: PROMPT_VERSION,
    });

    if (snapshot) {
      await logAnalysisRefreshed(entityId, {
        snapshot_id: snapshot.id,
      });
    }

    return snapshot;
  } catch (err) {
    console.error("[analysisService] refreshAnalysis failed:", err);
    return null;
  }
}
