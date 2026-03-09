import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { uploadFileToDealFolder, saveAIAssessmentToDrive } from "@/lib/google/drive";
import { analyzeAttachment, analyzeImageAttachment } from "@/lib/ai/analyzeAttachment";
import { transcribeAudio, isAudioFile } from "@/lib/ai/transcribeAudio";
import { extractTextFromBuffer } from "@/lib/files/extractText";
import { ingestFile } from "@/lib/services/DealFileIngestionService";
import { processDerivative } from "@/lib/services/DerivativeProcessingService";
import { updateDerivative } from "@/lib/db/derivatives";
import type { Deal, ExtractedFacts } from "@/types";
import type { AttachmentAnalysisResult } from "@/types";

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

function formatImageAssessment(result: AttachmentAnalysisResult): string {
  const lines = [
    `AI Assessment`,
    `=============`,
    ``,
    `Title: ${result.generated_title}`,
    `Type: ${result.detected_kind}`,
    `Confidence: ${result.confidence}`,
    ``,
    `Summary:`,
    result.summary,
    ``,
    `Change log: ${result.change_log_item.title}`,
    result.change_log_item.description,
  ];
  if (result.extracted_signals.keywords?.length) {
    lines.push(``, `Keywords: ${result.extracted_signals.keywords.join(", ")}`);
  }
  return lines.join("\n");
}

const IMAGE_MIME_PREFIX = "image/";
const MAX_IMAGE_ANALYSIS_BYTES = 4 * 1024 * 1024; // 4 MB for Vision API
const MAX_WHISPER_BYTES = 25 * 1024 * 1024; // 25 MB for Whisper API

export const maxDuration = 60;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ACCEPTED_EXTENSIONS = [
  ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".aac",
];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `"${file.name}" exceeds 100 MB limit.`;
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext))
    return `"${file.name}" is not a supported file type.`;
  return null;
}

function buildLogTitle(originalFileName: string): string {
  const ext = originalFileName.split(".").pop()?.toLowerCase() ?? "";
  const extLabels: Record<string, string> = {
    pdf: "PDF",
    doc: "Word document",
    docx: "Word document",
    xls: "Excel spreadsheet",
    xlsx: "Excel spreadsheet",
    csv: "CSV file",
    txt: "Text file",
    png: "Image",
    jpg: "Image",
    jpeg: "Image",
    gif: "Image",
    webp: "Image",
    mp3: "Audio",
    m4a: "Audio",
    mp4: "Audio",
    wav: "Audio",
    webm: "Audio",
    ogg: "Audio",
    aac: "Audio",
  };
  const label = extLabels[ext] ?? "File";
  return `${label} uploaded`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse form ────────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter((f): f is File => f instanceof File);
  const captureSource = (formData.get("captureSource") as string | null) ?? "file";

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // ── Validate all files up-front ───────────────────────────────────────────
  for (const file of files) {
    const err = validateFile(file);
    if (err) return NextResponse.json({ error: err }, { status: 422 });
  }

  // ── Verify deal ownership ─────────────────────────────────────────────────
  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("id, name")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  const deal = dealData as Pick<Deal, "id" | "name">;

  // ── Check Drive connection ────────────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json(
      { error: "Google Drive is not connected. Connect it in Settings → Integrations." },
      { status: 422 }
    );
  }

  // ── Upload each file ──────────────────────────────────────────────────────
  const results: {
    fileName: string;
    success: boolean;
    error?: string;
    googleFileId?: string;
  }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm")
      // Google Drive rejects MIME types with codec suffixes.
      const mimeType = (file.type || "application/octet-stream").split(";")[0].trim();

      // 1. Upload to Google Drive
      const driveMeta = await uploadFileToDealFolder({
        userId: user.id,
        dealId,
        dealName: deal.name,
        fileBuffer: buffer,
        originalFileName: file.name,
        mimeType,
        sourceKind: "uploaded_file",
      });

      // 2. AI analysis (images via Vision, audio via Whisper, documents via text extraction)
      type EntryAnalysis = { title: string; description: string; summary: string };
      let analysis: EntryAnalysis;
      const isImage = mimeType.startsWith(IMAGE_MIME_PREFIX);
      const isAudio = isAudioFile(mimeType, file.name);
      const fileBase = file.name.replace(/\.[^.]+$/, "") || "file";

      try {
        if (isImage && buffer.length <= MAX_IMAGE_ANALYSIS_BYTES) {
          const imageBase64 = buffer.toString("base64");
          const result = await analyzeImageAttachment({
            dealName: deal.name,
            driveFileName: driveMeta.googleFileName,
            originalFileName: file.name,
            mimeType,
            imageBase64,
          });
          analysis = {
            title: result.change_log_item.title,
            description: result.change_log_item.description,
            summary: result.summary,
          };
          try {
            await saveAIAssessmentToDrive({
              userId: user.id,
              dealId,
              dealName: deal.name,
              originalFileBase: fileBase,
              assessmentText: formatImageAssessment(result),
            });
          } catch (saveErr) {
            console.error("Failed to save image AI assessment to Drive:", saveErr);
          }
        } else if (isAudio) {
          const transcript =
            buffer.length <= MAX_WHISPER_BYTES
              ? await transcribeAudio(buffer, file.name)
              : null;
          if (transcript) {
            analysis = {
              title: "Recording added",
              description: transcript.length > 200 ? `${transcript.slice(0, 200)}…` : transcript,
              summary: transcript,
            };
            try {
              await saveAIAssessmentToDrive({
                userId: user.id,
                dealId,
                dealName: deal.name,
                originalFileBase: fileBase,
                assessmentText: `AI Transcript\n=============\n\n${transcript}`,
              });
            } catch (saveErr) {
              console.error("Failed to save audio transcript to Drive:", saveErr);
            }
          } else {
            analysis = {
              title: "Recording added",
              description: `"${file.name}" was uploaded. Transcription could not be completed.`,
              summary: `"${file.name}" was uploaded. Transcription could not be completed.`,
            };
          }
        } else {
          // extractTextFromBuffer never throws — returns a diagnostic note on failure.
          // Passing that note to the AI lets it still classify from filename + MIME type
          // and include the extraction issue in the summary.
          const contentPreview = await extractTextFromBuffer(buffer, file.name);
          const result = await analyzeAttachment({
            dealName: deal.name,
            driveFileName: driveMeta.googleFileName,
            originalFileName: file.name,
            mimeType,
            contentPreview,
          });
          analysis = {
            title: result.change_log_item.title,
            description: result.change_log_item.description,
            summary: result.summary,
          };
          try {
            await saveAIAssessmentToDrive({
              userId: user.id,
              dealId,
              dealName: deal.name,
              originalFileBase: fileBase,
              assessmentText: formatImageAssessment(result),
            });
          } catch (saveErr) {
            console.error("Failed to save document AI assessment to Drive:", saveErr);
          }
        }
      } catch (aiErr) {
        console.error("AI analysis failed, using fallback:", aiErr);
        const isDocScan = isImage && file.name.toLowerCase().startsWith("document");
        const fallback = isImage
          ? isDocScan
            ? { title: "Document scan added", description: "Document scan was added. AI analysis could not be completed." }
            : { title: "Photo added", description: "Photo was added. AI analysis could not be completed." }
          : isAudio
            ? { title: "Recording added", description: `"${file.name}" was uploaded. Transcription could not be completed.` }
            : { title: buildLogTitle(file.name), description: `"${file.name}" was uploaded to the deal folder.` };
        analysis = { ...fallback, summary: fallback.description };
      }

      // 3. Create entry (deal_source + deal_source_analysis) so it appears in Entries list
      const entryContent = `[File: ${driveMeta.googleFileName}]\n${analysis.description}`;
      const { data: sourceData, error: sourceError } = await supabase
        .from("deal_sources")
        .insert({
          deal_id: dealId,
          user_id: user.id,
          content: entryContent,
          title: analysis.title,
          source_type: "file",
        })
        .select("id")
        .single();

      let sourceId: string | null = null;
      if (!sourceError && sourceData) {
        sourceId = sourceData.id as string;
        await supabase.from("deal_source_analyses").insert({
          deal_source_id: sourceId,
          deal_id: dealId,
          user_id: user.id,
          generated_title: analysis.title,
          detected_type: "file",
          summary: analysis.summary,
          extracted_facts: EMPTY_FACTS,
          red_flags: [],
          missing_information: [],
          broker_questions: [],
        });
      }

      // 3b. Register in deal_files + deal_file_derivatives, then drive extraction.
      try {
        const sourceKind = isImage
          ? (captureSource === "camera" ? "webcam_photo" : "uploaded_image")
          : isAudio
            ? "audio_recording"
            : "uploaded_file";

        const { derivative } = await ingestFile({
          dealId,
          userId: user.id,
          originalFileName: file.name,
          mimeType: mimeType,
          sourceKind,
          googleFileId: driveMeta.googleFileId,
          googleFileName: driveMeta.googleFileName,
          webViewLink: driveMeta.webViewLink ?? null,
          sizeBytes: file.size,
          dealSourceId: sourceId,
        });

        if (isImage || isAudio) {
          // Already analyzed inline above — mark derivative done immediately
          // with the content we already computed, avoiding a redundant API call.
          const extractedText = isAudio
            ? analysis.summary  // full transcript
            : analysis.summary; // image AI summary
          updateDerivative({
            id: derivative.id,
            userId: user.id,
            extractionStatus: "done",
            extractedText,
            extractionModel: isAudio ? "whisper-1" : "gpt-4o-mini",
          }).catch((err) => {
            console.error("updateDerivative (inline) failed (non-fatal):", err);
          });
        } else {
          // PDF, spreadsheet, text — run extraction now (pdf-parse / xlsx are fast).
          processDerivative(derivative).catch((err) => {
            console.error("processDerivative failed (non-fatal):", err);
          });
        }
      } catch (derivErr) {
        // Non-fatal — ingestion record is best-effort
        console.error("ingestFile failed (non-fatal):", derivErr);
      }

      // 4. Log the upload in deal_change_log (linked to entry when created)
      await supabase.from("deal_change_log").insert({
        deal_id: dealId,
        user_id: user.id,
        deal_source_id: sourceId,
        related_google_file_id: driveMeta.googleFileId,
        change_type: "file_uploaded",
        title: analysis.title,
        description: analysis.description,
      });

      results.push({ fileName: file.name, success: true, googleFileId: driveMeta.googleFileId });
    } catch (err) {
      console.error(`Failed to upload "${file.name}":`, err);
      results.push({
        fileName: file.name,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const allFailed = results.every((r) => !r.success);
  if (allFailed) {
    return NextResponse.json(
      { error: "All file uploads failed.", results },
      { status: 500 }
    );
  }

  return NextResponse.json({ results }, { status: 201 });
}
