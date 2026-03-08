import OpenAI from "openai";
import type { AnalysisResult, ExtractedFacts, SourceType, ChangeLogItemType } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4.1-mini";

const SYSTEM_PROMPT = `You are an acquisition-deal analysis engine for a product called DealHub.

Your job is to analyze one newly added deal entry and help maintain an evolving history of the deal.

The user may paste any kind of raw deal information, including:
- business listing text
- broker emails
- financial summaries
- notes from calls
- copied website text
- miscellaneous acquisition notes

Your goals:
1. Identify what kind of entry this most likely is (listing, broker_email, financial_summary, note, or unknown)
2. Generate a concise, useful title for the entry (max 8 words)
3. Write a 1-3 sentence summary of the entry
4. Extract any important acquisition facts mentioned
5. Identify red flags or concerns (be conservative — only flag genuine issues)
6. Identify missing information that would be important for evaluating this deal
7. Suggest specific broker follow-up questions based on what is and isn't known
8. Generate change-log items describing what new facts, changes, or concerns this entry adds to the deal history

Important rules:
- Be precise and conservative — do not invent facts
- If a value is not mentioned, set it to null (not "unknown" or "N/A")
- Only include growth_claims and other_key_facts if genuinely present
- Red flags should be real concerns, not generic warnings
- Change-log items should describe what was newly learned or became noteworthy
- change_type must be one of: new_fact, updated_fact, concern, follow_up
- detected_type must be one of: listing, broker_email, financial_summary, note, unknown
- Return ONLY valid JSON — no markdown, no explanation, no code fences`;

function buildUserPrompt(params: {
  dealName: string;
  dealDescription: string | null;
  entryContent: string;
}): string {
  return `Deal context:
- Name: ${params.dealName}
- Description: ${params.dealDescription ?? "Not provided"}

New entry to analyze:
---
${params.entryContent}
---

Return a JSON object with this exact structure:
{
  "generated_title": "string",
  "detected_type": "listing | broker_email | financial_summary | note | unknown",
  "summary": "string",
  "extracted_facts": {
    "business_name": "string | null",
    "asking_price": "string | null",
    "revenue": "string | null",
    "sde": "string | null",
    "ebitda": "string | null",
    "industry": "string | null",
    "location": "string | null",
    "employees": "string | null",
    "rent": "string | null",
    "lease_term": "string | null",
    "ff_and_e": "string | null",
    "inventory": "string | null",
    "growth_claims": ["string"],
    "other_key_facts": ["string"]
  },
  "red_flags": ["string"],
  "missing_information": ["string"],
  "broker_questions": ["string"],
  "change_log_items": [
    {
      "change_type": "new_fact | updated_fact | concern | follow_up",
      "title": "string",
      "description": "string"
    }
  ]
}`;
}

const EMPTY_FACTS: ExtractedFacts = {
  business_name: null,
  asking_price: null,
  revenue: null,
  sde: null,
  ebitda: null,
  industry: null,
  location: null,
  employees: null,
  rent: null,
  lease_term: null,
  ff_and_e: null,
  inventory: null,
  growth_claims: [],
  other_key_facts: [],
};

function normalizeResult(raw: Record<string, unknown>): AnalysisResult {
  const facts = (raw.extracted_facts ?? {}) as Partial<ExtractedFacts>;

  return {
    generated_title:
      typeof raw.generated_title === "string"
        ? raw.generated_title
        : "Untitled Entry",
    detected_type: (["listing", "broker_email", "financial_summary", "note", "unknown"].includes(
      raw.detected_type as string
    )
      ? raw.detected_type
      : "unknown") as SourceType,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    extracted_facts: {
      ...EMPTY_FACTS,
      ...Object.fromEntries(
        Object.entries(facts).filter(([, v]) => v !== undefined)
      ),
      growth_claims: Array.isArray(facts.growth_claims) ? facts.growth_claims : [],
      other_key_facts: Array.isArray(facts.other_key_facts) ? facts.other_key_facts : [],
    },
    red_flags: Array.isArray(raw.red_flags)
      ? (raw.red_flags as string[]).filter((x) => typeof x === "string")
      : [],
    missing_information: Array.isArray(raw.missing_information)
      ? (raw.missing_information as string[]).filter((x) => typeof x === "string")
      : [],
    broker_questions: Array.isArray(raw.broker_questions)
      ? (raw.broker_questions as string[]).filter((x) => typeof x === "string")
      : [],
    change_log_items: Array.isArray(raw.change_log_items)
      ? (raw.change_log_items as Record<string, unknown>[])
          .filter(
            (item) =>
              typeof item.title === "string" &&
              typeof item.description === "string"
          )
          .map((item) => ({
            change_type: (["new_fact", "updated_fact", "concern", "follow_up"].includes(
              item.change_type as string
            )
              ? item.change_type
              : "new_fact") as ChangeLogItemType,
            title: item.title as string,
            description: item.description as string,
          }))
      : [],
  };
}

export async function analyzeDealEntry(params: {
  dealName: string;
  dealDescription: string | null;
  entryContent: string;
}): Promise<AnalysisResult> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(params) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: Record<string, unknown>;
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("analyzeDealEntry: failed to parse OpenAI response", raw);
    // Return a safe fallback so the entry is still saved
    return {
      generated_title: "Untitled Entry",
      detected_type: "unknown",
      summary: "Analysis could not be completed for this entry.",
      extracted_facts: EMPTY_FACTS,
      red_flags: [],
      missing_information: [],
      broker_questions: [],
      change_log_items: [],
    };
  }

  return normalizeResult(parsed);
}
