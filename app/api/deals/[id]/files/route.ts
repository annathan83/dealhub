import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { uploadFileToDealFolder, saveAIAssessmentToDrive } from "@/lib/google/drive";
import { analyzeAttachment, analyzeImageAttachment, analyzePdfAttachment } from "@/lib/ai/analyzeAttachment";
import { transcribeAudio, isAudioFile } from "@/lib/ai/transcribeAudio";
import { extractTextFromBuffer } from "@/lib/files/extractText";
import { ingestFromDealUpload } from "@/lib/services/entity/entityFileService";
import type { Deal } from "@/types";
import type { AttachmentAnalysisResult } from "@/types";

function formatAssessmentText(result: AttachmentAnalysisResult): string {
  return [
    `AI Assessment`,
    `=============`,
    ``,
    `Title: ${result.generated_title}`,
    `Type: ${result.detected_kind}`,
    ``,
    `Summary:`,
    result.summary,
    ``,
    `Change log: ${result.change_log_item.title}`,
    result.change_log_item.description,
    ...(result.extracted_signals.keywords?.length
      ? [``, `Keywords: ${result.extracted_signals.keywords.join(", ")}`]
      : []),
  ].join("\n");
}

const IMAGE_MIME_PREFIX = "image/";
const MAX_IMAGE_ANALYSIS_BYTES = 4 * 1024 * 1024;
const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

export const maxDuration = 120;

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [
  ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".aac",
];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `"${file.name}" exceeds 100 MB limit.`;
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return `"${file.name}" is not a supported file type.`;
  return null;
}

function buildLogTitle(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const labels: Record<string, string> = {
    pdf: "PDF", doc: "Word document", docx: "Word document",
    xls: "Excel spreadsheet", xlsx: "Excel spreadsheet", csv: "CSV file",
    txt: "Text file", png: "Image", jpg: "Image", jpeg: "Image", gif: "Image", webp: "Image",
    mp3: "Audio", m4a: "Audio", mp4: "Audio", wav: "Audio", webm: "Audio", ogg: "Audio", aac: "Audio",
  };
  return `${labels[ext] ?? "File"} uploaded`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter((f): f is File => f instanceof File);
  const captureSource = (formData.get("captureSource") as string | null) ?? "file";

  if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  for (const file of files) {
    const err = validateFile(file);
    if (err) return NextResponse.json({ error: err }, { status: 422 });
  }

  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("id, name")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  const deal = dealData as Pick<Deal, "id" | "name">;

  const { data: tokenRow, error: tokenError } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    console.error(`[upload] No Google OAuth token for user ${user.id}:`, tokenError?.message);
    return NextResponse.json(
      { error: "Google Drive is not connected. Connect it in Settings → Integrations." },
      { status: 422 }
    );
  }

  const results: { fileName: string; success: boolean; error?: string; googleFileId?: string }[] = [];

  for (const file of files) {
    try {
      console.log(`[upload] Processing "${file.name}" (${file.size} bytes, ${file.type}) for deal ${dealId}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = (file.type || "application/octet-stream").split(";")[0].trim();

      // ── 1. Upload to Google Drive ─────────────────────────────────────────
      console.log(`[upload] Uploading "${file.name}" to Google Drive...`);
      const driveMeta = await uploadFileToDealFolder({
        userId: user.id,
        dealId,
        dealName: deal.name,
        fileBuffer: buffer,
        originalFileName: file.name,
        mimeType,
        sourceKind: "uploaded_file",
      });

      // ── 2. AI analysis + text extraction ─────────────────────────────────
      type EntryAnalysis = { title: string; description: string; summary: string };
      let analysis: EntryAnalysis;
      const isImage = mimeType.startsWith(IMAGE_MIME_PREFIX);
      const isAudio = isAudioFile(mimeType, file.name);
      const fileBase = file.name.replace(/\.[^.]+$/, "") || "file";
      let documentExtractedText: string | null = null;
      let documentExtractionMethod = "pdf-parse";

      try {
        if (isImage && buffer.length <= MAX_IMAGE_ANALYSIS_BYTES) {
          const result = await analyzeImageAttachment({
            dealName: deal.name,
            driveFileName: driveMeta.googleFileName,
            originalFileName: file.name,
            mimeType,
            imageBase64: buffer.toString("base64"),
          });
          analysis = { title: result.change_log_item.title, description: result.change_log_item.description, summary: result.summary };
          saveAIAssessmentToDrive({ userId: user.id, dealId, dealName: deal.name, originalFileBase: fileBase, assessmentText: formatAssessmentText(result) })
            .catch((e) => console.error("Drive AI save failed:", e));

        } else if (isAudio) {
          const transcript = buffer.length <= MAX_WHISPER_BYTES ? await transcribeAudio(buffer, file.name) : null;
          if (transcript) {
            analysis = { title: "Recording added", description: transcript.slice(0, 200) + (transcript.length > 200 ? "…" : ""), summary: transcript };
            saveAIAssessmentToDrive({ userId: user.id, dealId, dealName: deal.name, originalFileBase: fileBase, assessmentText: `AI Transcript\n=============\n\n${transcript}` })
              .catch((e) => console.error("Drive transcript save failed:", e));
          } else {
            analysis = { title: "Recording added", description: `"${file.name}" uploaded. Transcription unavailable.`, summary: `"${file.name}" uploaded.` };
          }

        } else {
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          const contentPreview = await extractTextFromBuffer(buffer, file.name);
          const isScannedPdf = ext === "pdf" && contentPreview.startsWith("[Text extraction note:") && contentPreview.includes("scanned");

          if (!contentPreview.startsWith("[Text extraction note:")) {
            documentExtractedText = contentPreview;
          }
          documentExtractionMethod = ext === "pdf" ? "pdf-parse"
            : ext === "docx" || ext === "doc" ? "mammoth"
            : ext === "xlsx" || ext === "xls" ? "xlsx"
            : ext === "csv" ? "csv" : "text";

          const result = isScannedPdf
            ? await analyzePdfAttachment({ dealName: deal.name, originalFileName: file.name, pdfBuffer: buffer })
            : await analyzeAttachment({ dealName: deal.name, driveFileName: driveMeta.googleFileName, originalFileName: file.name, mimeType, contentPreview });
          analysis = { title: result.change_log_item.title, description: result.change_log_item.description, summary: result.summary };
          saveAIAssessmentToDrive({ userId: user.id, dealId, dealName: deal.name, originalFileBase: fileBase, assessmentText: formatAssessmentText(result) })
            .catch((e) => console.error("Drive AI save failed:", e));
        }
      } catch (aiErr) {
        console.error("AI analysis failed, using fallback:", aiErr);
        const fallback = isImage
          ? { title: "Photo added", description: "Photo added. AI analysis unavailable." }
          : isAudio
            ? { title: "Recording added", description: `"${file.name}" uploaded. Transcription unavailable.` }
            : { title: buildLogTitle(file.name), description: `"${file.name}" uploaded.` };
        analysis = { ...fallback, summary: fallback.description };
      }

      // ── 3. Entity pipeline: text → facts → triage summary ────────────────
      const sourceType = isImage
        ? (captureSource === "camera" ? "webcam_photo" : "uploaded_image")
        : isAudio ? "audio_recording" : "uploaded_file";

      const extractionMethod = isAudio ? "whisper" : isImage ? "vision" : documentExtractionMethod;
      const extractedText = isImage || isAudio ? analysis.summary : documentExtractedText;

      // Await the entity pipeline so fact extraction completes before we return.
      // This ensures the Facts tab shows extracted values immediately after upload.
      await ingestFromDealUpload({
        dealId, userId: user.id,
        googleFileId: driveMeta.googleFileId,
        originalFileName: file.name,
        mimeType, fileSizeBytes: file.size,
        sourceType, extractedText: extractedText ?? null, extractionMethod,
        title: analysis.title,
        summary: analysis.summary,
        webViewLink: driveMeta.webViewLink ?? null,
        driveCreatedTime: driveMeta.createdTime ?? null,
      });

      console.log(`[upload] "${file.name}" complete. Drive ID: ${driveMeta.googleFileId}`);
      results.push({ fileName: file.name, success: true, googleFileId: driveMeta.googleFileId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[upload] FAILED "${file.name}":`, msg, err);
      results.push({ fileName: file.name, success: false, error: msg });
    }
  }

  const allFailed = results.every((r) => !r.success);
  if (allFailed) return NextResponse.json({ error: "All file uploads failed.", results }, { status: 500 });

  return NextResponse.json({ results }, { status: 201 });
}
