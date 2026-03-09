/**
 * triageSummaryService
 *
 * Lightweight triage pass that runs immediately after initial fact extraction.
 * Produces a short, grounded, neutral AI summary of what is known so far.
 *
 * Design constraints:
 * - Uses only the 15 fixed triage facts (never the full fact set)
 * - Prompt is strictly neutral — no verdicts, no recommendations
 * - Stores result as an analysis_snapshot with type "triage_summary"
 * - Updates deal.status to "triaged" and sets deal.triaged_at
 * - Never throws — all errors are logged and swallowed
 */

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  insertAnalysisSnapshot,
} from "@/lib/db/entities";
import { logEntityEvent } from "./entityEventService";
import type { AnalysisSnapshot } from "@/types/entity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";
const PROMPT_VERSION = "triage-v1";

// ─── Fixed triage fact keys ───────────────────────────────────────────────────
// These 15 facts are the only ones shown in the Initial Review section.
// They map to keys in the fact_definitions table.

export const TRIAGE_FACT_KEYS = [
  "asking_price",
  "location",
  "industry",
  "revenue_latest",
  "sde_or_ebitda",
  "revenue_trend",
  "profit_margin",
  "employees_ft_pt",
  "owner_hours",
  "manager_in_place",
  "years_in_business",
  "customer_concentration",
  "reason_for_sale",
  "real_estate_included",
  "inventory_included",
] as const;

export type TriageFactKey = (typeof TRIAGE_FACT_KEYS)[number];

export type TriageFactStatus = "found" | "missing" | "ambiguous";

export type TriageFact = {
  key: TriageFactKey | string;
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run triage summary for an entity. Stores the result as an analysis_snapshot
 * and updates the deal status to "triaged". Non-fatal.
 */
export async function runTriageSummary(
  entityId: string,
  entityTypeId: string,
  dealId: string,
  dealTitle: string
): Promise<AnalysisSnapshot | null> {
  try {
    const supabase = await createClient();

    // 1. Load all fact definitions and current values
    const [allFactDefs, currentFacts] = await Promise.all([
      getFactDefinitionsForEntityType(entityTypeId),
      getCurrentFactsForEntity(entityId),
    ]);

    // 2. Build triage fact set (fixed 15 keys, fall back to any matching label)
    const factDefByKey = new Map(allFactDefs.map((fd) => [fd.key, fd]));
    const factValueByDefId = new Map(currentFacts.map((fv) => [fv.fact_definition_id, fv]));

    const triageFacts: TriageFact[] = TRIAGE_FACT_KEYS.map((key) => {
      const def = factDefByKey.get(key);
      if (!def) {
        return {
          key,
          label: key.replace(/_/g, " "),
          value: null,
          confidence: null,
          source: null,
          status: "missing" as TriageFactStatus,
        };
      }

      const val = factValueByDefId.get(def.id);
      const hasValue = val && val.value_raw && val.status !== "missing";

      return {
        key,
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

    // 3. Build context strings for the prompt
    const foundFacts = triageFacts.filter((f) => f.status !== "missing");
    const missingFacts = triageFacts.filter((f) => f.status === "missing");

    const factsContext = foundFacts.length > 0
      ? foundFacts.map((f) => {
          const ambig = f.status === "ambiguous" ? " [ambiguous]" : "";
          return `${f.label}: ${f.value}${ambig}`;
        }).join("\n")
      : "No facts extracted yet.";

    const missingFactLabels = missingFacts.map((f) => f.label);

    // 4. Call AI for the neutral summary
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

    // 5. Build the full content object
    const content: TriageSummaryContent = {
      summary,
      facts: triageFacts,
      notable_positives: notablePositives,
      notable_concerns: notableConcerns,
      missing_facts: missingFactLabels,
      facts_found: foundFacts.length,
      facts_missing: missingFacts.length,
    };

    // 6. Store as analysis_snapshot
    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "triage_summary",
      title: `Initial Review — ${dealTitle}`,
      content_json: content as unknown as Record<string, unknown>,
      model_name: foundFacts.length > 0 ? MODEL : null,
      prompt_version: PROMPT_VERSION,
    });

    // 7. Update deal status to "triaged"
    await supabase
      .from("deals")
      .update({ status: "triaged", triaged_at: new Date().toISOString() })
      .eq("id", dealId);

    // 8. Log the event
    await logEntityEvent(entityId, "triage_completed", {
      facts_found: foundFacts.length,
      facts_missing: missingFacts.length,
      snapshot_id: snapshot?.id ?? null,
    });

    return snapshot;
  } catch (err) {
    console.error("[triageSummaryService] runTriageSummary failed (non-fatal):", err);
    return null;
  }
}
