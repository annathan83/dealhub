/**
 * factExtractionService
 *
 * Calls GPT-4o-mini with extracted text + a list of applicable fact_definitions
 * and returns structured fact candidates with confidence scores and snippets.
 *
 * Strategy: extract ALL available facts from every document upload.
 * The more facts extracted, the better the scoring and analysis.
 */

import OpenAI from "openai";
import type { FactDefinition } from "@/types/entity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";
const EXTRACTOR_VERSION = "v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtractedFactCandidate = {
  fact_key: string;
  extracted_value_raw: string;
  normalized_value: Record<string, unknown>;
  confidence: number;
  snippet: string | null;
  page_number: number | null;
};

export type FactExtractionResult = {
  candidates: ExtractedFactCandidate[];
  model_name: string;
  extractor_version: string;
  input_tokens: number | null;
  output_tokens: number | null;
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildExtractionPrompt(
  text: string,
  factDefs: FactDefinition[],
  entityTitle: string
): string {
  const factList = factDefs
    .map(
      (fd) =>
        `- key: "${fd.key}" | label: "${fd.label}" | type: ${fd.data_type}` +
        (fd.description ? ` | hint: ${fd.description}` : "")
    )
    .join("\n");

  return `You are a business acquisition analyst. Extract ALL available structured facts from the document below. Extract as many facts as you can find.

Entity: ${entityTitle}

Facts to extract:
${factList}

Instructions:
- Extract EVERY fact that is explicitly stated or clearly implied in the document.
- Do NOT guess or hallucinate values not present in the text.
- For currency values, return the numeric amount (e.g. 1500000 for $1.5M).
- For percentages, return the decimal (e.g. 0.25 for 25%).
- For boolean facts, return "true" or "false".
- confidence: 0.0–1.0 (1.0 = explicitly stated, 0.5 = clearly implied, 0.3 = estimated).
- snippet: the exact text from the document that supports this fact (≤200 chars).
- If a fact is not present in the document, omit it entirely.
- Extract ALL financial figures, employee counts, operational details, and deal terms you can find.

Return a JSON object with this exact structure:
{
  "facts": [
    {
      "fact_key": "asking_price",
      "extracted_value_raw": "1500000",
      "normalized_value": { "amount": 1500000, "currency": "USD" },
      "confidence": 0.95,
      "snippet": "The business is listed at $1.5 million",
      "page_number": null
    }
  ]
}

Document text (first 8000 chars):
---
${text.slice(0, 8000)}
---`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract facts from a text chunk using GPT-4o-mini.
 * Returns an empty candidates array on failure (non-fatal).
 */
export async function extractFactsFromText(
  text: string,
  factDefs: FactDefinition[],
  entityTitle: string
): Promise<FactExtractionResult> {
  if (!text || text.trim().length === 0 || factDefs.length === 0) {
    return {
      candidates: [],
      model_name: MODEL,
      extractor_version: EXTRACTOR_VERSION,
      input_tokens: null,
      output_tokens: null,
    };
  }

  try {
    const prompt = buildExtractionPrompt(text, factDefs, entityTitle);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 3000,
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";
    let parsed: { facts?: unknown[] } = {};

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("[factExtractionService] Failed to parse GPT response:", rawContent.slice(0, 200));
      return {
        candidates: [],
        model_name: MODEL,
        extractor_version: EXTRACTOR_VERSION,
        input_tokens: response.usage?.prompt_tokens ?? null,
        output_tokens: response.usage?.completion_tokens ?? null,
      };
    }

    const validKeys = new Set(factDefs.map((fd) => fd.key));
    const candidates: ExtractedFactCandidate[] = [];

    for (const item of parsed.facts ?? []) {
      if (!item || typeof item !== "object") continue;
      const f = item as Record<string, unknown>;
      const key = f.fact_key as string;

      if (!key || !validKeys.has(key)) continue;

      const rawValue = f.extracted_value_raw;
      if (!rawValue || String(rawValue).trim() === "") continue;

      const confidence = typeof f.confidence === "number"
        ? Math.min(1, Math.max(0, f.confidence))
        : 0.5;

      candidates.push({
        fact_key: key,
        extracted_value_raw: String(rawValue),
        normalized_value: (f.normalized_value as Record<string, unknown>) ?? {},
        confidence,
        snippet: typeof f.snippet === "string" ? f.snippet.slice(0, 300) : null,
        page_number: typeof f.page_number === "number" ? f.page_number : null,
      });
    }

    return {
      candidates,
      model_name: MODEL,
      extractor_version: EXTRACTOR_VERSION,
      input_tokens: response.usage?.prompt_tokens ?? null,
      output_tokens: response.usage?.completion_tokens ?? null,
    };
  } catch (err) {
    console.error("[factExtractionService] extractFactsFromText failed:", err);
    return {
      candidates: [],
      model_name: MODEL,
      extractor_version: EXTRACTOR_VERSION,
      input_tokens: null,
      output_tokens: null,
    };
  }
}
