// Server-side only — never import from client components

import OpenAI from "openai";
import type {
  AttachmentAnalysisResult,
  AttachmentKind,
  AttachmentConfidence,
} from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4.1-mini";
const VISION_MODEL = "gpt-4o-mini"; // Vision-capable for image analysis

const VALID_KINDS: AttachmentKind[] = [
  "pnl",
  "tax_return",
  "balance_sheet",
  "lease",
  "broker_listing",
  "broker_email_export",
  "payroll",
  "bank_statement",
  "marketing_material",
  "spreadsheet",
  "image",
  "document",
  "unknown",
];

const KIND_LABELS: Record<AttachmentKind, string> = {
  pnl: "P&L Statement",
  tax_return: "Tax Return",
  balance_sheet: "Balance Sheet",
  lease: "Lease Document",
  broker_listing: "Broker Listing",
  broker_email_export: "Broker Email Export",
  payroll: "Payroll Report",
  bank_statement: "Bank Statement",
  marketing_material: "Marketing Material",
  spreadsheet: "Spreadsheet",
  image: "Image",
  document: "Document",
  unknown: "Attachment",
};

const SYSTEM_PROMPT = `You are an attachment classification engine for DealHub, a business acquisition workspace.

Your job is to analyze an uploaded file and determine what kind of deal document it most likely is.

You will receive:
- The file name (timestamped Drive name)
- The original file name as uploaded by the user
- The MIME type
- Optionally: extracted text content (first ~2000 characters)

Your goals:
1. Classify the document into one of the allowed kinds
2. Generate a short, useful title (max 8 words)
3. Write a 1-2 sentence summary of what this document appears to be
4. Assign a confidence level
5. Extract keyword signals that led to your classification
6. Generate a concise deal log entry

Allowed kinds:
pnl | tax_return | balance_sheet | lease | broker_listing | broker_email_export | payroll | bank_statement | marketing_material | spreadsheet | image | document | unknown

Rules:
- Be conservative — use "unknown" or "document" if unsure
- Do not invent facts not present in the filename or content
- confidence must be "high" only if you are very certain
- Return ONLY valid JSON — no markdown, no explanation`;

function buildPrompt(params: {
  dealName: string;
  driveFileName: string;
  originalFileName: string;
  mimeType: string;
  contentPreview: string | null;
}): string {
  const lines = [
    `Deal: ${params.dealName}`,
    `Drive file name: ${params.driveFileName}`,
    `Original file name: ${params.originalFileName}`,
    `MIME type: ${params.mimeType}`,
  ];

  if (params.contentPreview?.trim()) {
    lines.push(`\nContent preview (first ~2000 chars):\n---\n${params.contentPreview.slice(0, 2000)}\n---`);
  } else {
    lines.push(`\nNo text content available — classify from metadata only.`);
  }

  lines.push(`
Return a JSON object with this exact structure:
{
  "detected_kind": "pnl | tax_return | balance_sheet | lease | broker_listing | broker_email_export | payroll | bank_statement | marketing_material | spreadsheet | image | document | unknown",
  "generated_title": "string (max 8 words)",
  "summary": "string (1-2 sentences)",
  "confidence": "high | medium | low",
  "extracted_signals": {
    "extension": "string",
    "mime_type": "string",
    "keywords": ["string"]
  },
  "change_log_item": {
    "change_type": "file_uploaded",
    "title": "string",
    "description": "string"
  }
}`);

  return lines.join("\n");
}

function normalize(
  raw: Record<string, unknown>,
  originalFileName: string,
  mimeType: string
): AttachmentAnalysisResult {
  const ext = originalFileName.includes(".")
    ? originalFileName.split(".").pop()?.toLowerCase() ?? ""
    : "";

  const kind = VALID_KINDS.includes(raw.detected_kind as AttachmentKind)
    ? (raw.detected_kind as AttachmentKind)
    : "unknown";

  const confidence = (["high", "medium", "low"] as AttachmentConfidence[]).includes(
    raw.confidence as AttachmentConfidence
  )
    ? (raw.confidence as AttachmentConfidence)
    : "low";

  const signals = (raw.extracted_signals ?? {}) as Record<string, unknown>;
  const keywords = Array.isArray(signals.keywords)
    ? (signals.keywords as unknown[]).filter((k) => typeof k === "string") as string[]
    : [];

  const logItem = (raw.change_log_item ?? {}) as Record<string, unknown>;
  const fallbackTitle = `${KIND_LABELS[kind]} uploaded`;
  const fallbackDesc = `File "${originalFileName}" was attached to this deal.`;

  return {
    detected_kind: kind,
    generated_title:
      typeof raw.generated_title === "string" && raw.generated_title.trim()
        ? raw.generated_title
        : fallbackTitle,
    summary:
      typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary
        : fallbackDesc,
    confidence,
    extracted_signals: {
      extension: ext,
      mime_type: mimeType,
      keywords,
    },
    change_log_item: {
      change_type: "file_uploaded",
      title:
        typeof logItem.title === "string" && logItem.title.trim()
          ? logItem.title
          : fallbackTitle,
      description:
        typeof logItem.description === "string" && logItem.description.trim()
          ? logItem.description
          : fallbackDesc,
    },
  };
}

export async function analyzeAttachment(params: {
  dealName: string;
  driveFileName: string;
  originalFileName: string;
  mimeType: string;
  contentPreview: string | null;
}): Promise<AttachmentAnalysisResult> {
  const { originalFileName, mimeType } = params;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(params) },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return normalize(parsed, originalFileName, mimeType);
  } catch (err) {
    console.error("analyzeAttachment failed:", err);
    // Safe fallback — never block the upload
    return {
      detected_kind: "unknown",
      generated_title: "File uploaded",
      summary: `File "${originalFileName}" was attached to this deal. Classification pending.`,
      confidence: "low",
      extracted_signals: {
        extension: originalFileName.split(".").pop()?.toLowerCase() ?? "",
        mime_type: mimeType,
        keywords: [],
      },
      change_log_item: {
        change_type: "file_uploaded",
        title: "File uploaded",
        description: `"${originalFileName}" was attached. Classification could not be completed.`,
      },
    };
  }
}

const PHOTO_SYSTEM_PROMPT = `You are an attachment classification engine for DealHub, a business acquisition workspace.

You are analyzing a PHOTO that was captured or uploaded for a deal.

Your job:
1. Describe what the image shows in ONE sentence (e.g., "Shows a P&L statement for Q3 2024" or "Photo of a storefront with signage")
2. Classify into: pnl | tax_return | balance_sheet | lease | broker_listing | broker_email_export | payroll | bank_statement | marketing_material | spreadsheet | image | document | unknown
3. Return a change_log_item where:
   - title: MUST be exactly "Photo added"
   - description: ONE sentence describing the image content (what you see, any readable text, or type of document)

Rules:
- change_log_item.title must always be "Photo added"
- change_log_item.description must be exactly one sentence about the image content
- Do not invent text that is not clearly visible
- Return ONLY valid JSON — no markdown, no explanation`;

const DOCUMENT_SCAN_SYSTEM_PROMPT = `You are an attachment classification engine for DealHub, a business acquisition workspace.

You are analyzing a DOCUMENT SCAN (photo of a document, receipt, or printed page) that was captured for a deal.

Your job:
1. Extract and summarize the key information from the document (numbers, dates, names, amounts)
2. Classify into: pnl | tax_return | balance_sheet | lease | broker_listing | broker_email_export | payroll | bank_statement | marketing_material | spreadsheet | document | unknown
3. Return a change_log_item where:
   - title: MUST be exactly "Document scan added"
   - description: ONE sentence summarizing the document content (e.g., "P&L statement showing $450K revenue, $120K SDE" or "Lease agreement for 5 years at $3,200/month")

Rules:
- change_log_item.title must always be "Document scan added"
- change_log_item.description must summarize the document's key information
- Do not invent text that is not clearly visible
- Return ONLY valid JSON — no markdown, no explanation`;

function isDocumentScan(filename: string): boolean {
  return filename.toLowerCase().startsWith("document");
}

export async function analyzeImageAttachment(params: {
  dealName: string;
  driveFileName: string;
  originalFileName: string;
  mimeType: string;
  imageBase64: string;
}): Promise<AttachmentAnalysisResult> {
  const { originalFileName, mimeType } = params;
  const isDoc = isDocumentScan(originalFileName);
  const systemPrompt = isDoc ? DOCUMENT_SCAN_SYSTEM_PROMPT : PHOTO_SYSTEM_PROMPT;
  const title = isDoc ? "Document scan added" : "Photo added";

  try {
    const mediaType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";
    const response = await openai.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Deal: ${params.dealName}\nFile: ${params.originalFileName}\n\nAnalyze this ${isDoc ? "document scan" : "photo"}. Return JSON with change_log_item: { "title": "${title}", "description": "<one sentence>" }. Also include detected_kind, generated_title, summary, confidence, extracted_signals.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${params.imageBase64}` },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return normalize(parsed, originalFileName, mimeType);
  } catch (err) {
    console.error("analyzeImageAttachment failed:", err);
    const isDoc = isDocumentScan(originalFileName);
    return {
      detected_kind: isDoc ? "document" : "image",
      generated_title: isDoc ? "Document scan uploaded" : "Photo uploaded",
      summary: `${isDoc ? "Document scan" : "Photo"} "${originalFileName}" was attached to this deal.`,
      confidence: "low",
      extracted_signals: {
        extension: originalFileName.split(".").pop()?.toLowerCase() ?? "",
        mime_type: mimeType,
        keywords: [],
      },
      change_log_item: {
        change_type: "file_uploaded",
        title: isDoc ? "Document scan added" : "Photo added",
        description: isDoc
          ? "Document scan was added. AI analysis could not be completed."
          : "Photo was added. AI analysis could not be completed.",
      },
    };
  }
}
