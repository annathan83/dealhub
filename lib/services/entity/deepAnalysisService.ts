/**
 * deepAnalysisService
 *
 * Runs the deep AI analysis pass for a deal entity.
 * Uses the AnalysisContext assembled by analysisContextBuilder — never reads
 * raw files or re-uploads blobs.
 *
 * Outputs:
 *   - executive_summary  (250–500 words, neutral)
 *   - key_risks          (structured list)
 *   - broker_questions   (prioritized list)
 *   - valuation_support  (numbers + caveat commentary)
 *   - data_gaps          (material missing info)
 *
 * Prompt guardrails:
 *   - Use only supplied facts and text
 *   - Distinguish knowns from unknowns explicitly
 *   - Never say "buy this" or "pass"
 *   - Never hallucinate missing numbers
 *   - Flag material data gaps
 */

import OpenAI from "openai";
import { insertAnalysisSnapshot } from "@/lib/db/entities";
import type { AnalysisContext } from "./analysisContextBuilder";
import type { AnalysisSnapshot } from "@/types/entity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";
const PROMPT_VERSION = "deep-v1";

// ─── Output types ─────────────────────────────────────────────────────────────

export type DeepAnalysisRisk = {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

export type DeepAnalysisBrokerQuestion = {
  question: string;
  priority: "high" | "medium";
  context: string | null;
};

export type DeepAnalysisValuationSupport = {
  asking_price: string | null;
  latest_sde: string | null;
  latest_ebitda: string | null;
  implied_multiple: string | null;
  commentary: string;
  data_sufficient: boolean;
};

export type DeepAnalysisContent = {
  executive_summary: string;
  key_risks: DeepAnalysisRisk[];
  broker_questions: DeepAnalysisBrokerQuestion[];
  valuation_support: DeepAnalysisValuationSupport;
  data_gaps: string[];
  trigger: string;
  model_name: string;
  prompt_version: string;
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildDeepAnalysisPrompt(ctx: AnalysisContext): string {
  return `You are a neutral business acquisition analyst. Your job is to help a buyer understand what is known and unknown about a business they are evaluating. You do not make buy/pass recommendations. You synthesize evidence, surface risks, and identify what information is still needed.

Business: ${ctx.entity_title}

=== KNOWN FACTS ===
${ctx.facts_context}

=== SOURCE DOCUMENTS ===
${ctx.source_metadata}

=== EXTRACTED TEXT ===
${ctx.text_corpus}

---

Produce a structured analysis with the following sections. Base everything strictly on the information above. If a fact is not present, say so — do not estimate or invent numbers.

Return ONLY valid JSON with this exact structure:
{
  "executive_summary": "<250–500 word neutral synthesis of what is known about this business. Cover: what the business does, key financial metrics available, operational characteristics, deal structure if known, and what material information is still missing. Do NOT say 'this looks like a good deal', 'worth pursuing', 'pass on this', or any directive language.>",
  "key_risks": [
    {
      "title": "<short risk title>",
      "detail": "<one to two sentence explanation of the risk based on available evidence>",
      "severity": "<high | medium | low>"
    }
  ],
  "broker_questions": [
    {
      "question": "<specific, actionable question>",
      "priority": "<high | medium>",
      "context": "<why this question matters given what is known or missing, or null>"
    }
  ],
  "valuation_support": {
    "asking_price": "<stated asking price or null>",
    "latest_sde": "<latest SDE figure or null>",
    "latest_ebitda": "<latest EBITDA figure or null>",
    "implied_multiple": "<asking price / SDE or EBITDA, formatted as e.g. '3.2x', or null if either is missing>",
    "commentary": "<2–4 sentences on what the numbers suggest, with explicit caveats where data is thin. Never say whether the multiple is good or bad — just state what it is and what is missing.>",
    "data_sufficient": <true if asking price AND at least one of SDE/EBITDA are available, false otherwise>
  },
  "data_gaps": [
    "<one material piece of missing information per item — things that would materially change the analysis if known>"
  ]
}

Rules:
- key_risks: 3–7 items, ordered by severity descending
- broker_questions: 4–8 items, high-priority questions first
- data_gaps: 3–6 items maximum
- Do not repeat information across sections unnecessarily
- If there is truly insufficient data to write a meaningful executive_summary, write a short honest statement of what is known and what is needed`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run deep AI analysis using the pre-built context.
 * Stores result as an analysis_snapshot with type "deep_analysis".
 * Returns the snapshot or null on failure.
 */
export async function runDeepAnalysis(
  entityId: string,
  entityTitle: string,
  context: AnalysisContext,
  trigger: string = "manual_run"
): Promise<AnalysisSnapshot | null> {
  try {
    const prompt = buildDeepAnalysisPrompt(context);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.15,
      max_tokens: 3000,
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawContent) as Record<string, unknown>;
    } catch {
      console.error("[deepAnalysisService] Failed to parse GPT response:", rawContent.slice(0, 300));
      return null;
    }

    // Normalize and validate output
    const executiveSummary = typeof parsed.executive_summary === "string"
      ? parsed.executive_summary.trim()
      : "Analysis could not be completed. Please try again.";

    const keyRisks: DeepAnalysisRisk[] = Array.isArray(parsed.key_risks)
      ? (parsed.key_risks as Record<string, unknown>[])
          .filter((r) => typeof r.title === "string")
          .map((r) => ({
            title: r.title as string,
            detail: typeof r.detail === "string" ? r.detail : "",
            severity: (["high", "medium", "low"].includes(r.severity as string)
              ? r.severity
              : "medium") as DeepAnalysisRisk["severity"],
          }))
          .slice(0, 7)
      : [];

    const brokerQuestions: DeepAnalysisBrokerQuestion[] = Array.isArray(parsed.broker_questions)
      ? (parsed.broker_questions as Record<string, unknown>[])
          .filter((q) => typeof q.question === "string")
          .map((q) => ({
            question: q.question as string,
            priority: (["high", "medium"].includes(q.priority as string)
              ? q.priority
              : "medium") as DeepAnalysisBrokerQuestion["priority"],
            context: typeof q.context === "string" ? q.context : null,
          }))
          .slice(0, 8)
      : [];

    const rawValuation = (parsed.valuation_support ?? {}) as Record<string, unknown>;
    const valuationSupport: DeepAnalysisValuationSupport = {
      asking_price: typeof rawValuation.asking_price === "string" ? rawValuation.asking_price : null,
      latest_sde: typeof rawValuation.latest_sde === "string" ? rawValuation.latest_sde : null,
      latest_ebitda: typeof rawValuation.latest_ebitda === "string" ? rawValuation.latest_ebitda : null,
      implied_multiple: typeof rawValuation.implied_multiple === "string" ? rawValuation.implied_multiple : null,
      commentary: typeof rawValuation.commentary === "string"
        ? rawValuation.commentary
        : "Insufficient data for valuation commentary.",
      data_sufficient: typeof rawValuation.data_sufficient === "boolean"
        ? rawValuation.data_sufficient
        : false,
    };

    const dataGaps: string[] = Array.isArray(parsed.data_gaps)
      ? (parsed.data_gaps as unknown[])
          .filter((g): g is string => typeof g === "string")
          .slice(0, 6)
      : [];

    const content: DeepAnalysisContent = {
      executive_summary: executiveSummary,
      key_risks: keyRisks,
      broker_questions: brokerQuestions,
      valuation_support: valuationSupport,
      data_gaps: dataGaps,
      trigger,
      model_name: MODEL,
      prompt_version: PROMPT_VERSION,
    };

    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "deep_analysis",
      title: `Deep Analysis — ${entityTitle}`,
      content_json: content as unknown as Record<string, unknown>,
      model_name: MODEL,
      prompt_version: PROMPT_VERSION,
    });

    return snapshot;
  } catch (err) {
    console.error("[deepAnalysisService] runDeepAnalysis failed:", err);
    return null;
  }
}
