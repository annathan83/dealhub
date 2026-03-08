import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { uploadFileToDealFolder } from "@/lib/google/drive";
import type { Deal } from "@/types";

export const maxDuration = 60;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return "File too large. Maximum size is 100 MB.";
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext))
    return `Unsupported file type. Accepted: PDF, Word, Excel, TXT, CSV, images.`;
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

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const validationError = validateFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
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

  // ── Upload to Google Drive (if connected) ─────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (tokenRow) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const driveMeta = await uploadFileToDealFolder({
        userId: user.id,
        dealId,
        dealName: deal.name,
        fileBuffer: buffer,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sourceKind: "uploaded_file",
      });

      // Log the upload
      await supabase.from("deal_change_log").insert({
        deal_id: dealId,
        user_id: user.id,
        deal_source_id: null,
        related_google_file_id: driveMeta.googleFileId,
        change_type: "file_uploaded",
        title: buildLogTitle(file.name),
        description: `"${file.name}" was uploaded to the deal folder.`,
      });
    } catch (driveErr) {
      console.error("Drive upload failed:", driveErr);
      return NextResponse.json(
        { error: "File upload to Google Drive failed. Please try again." },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Google Drive is not connected. Connect it in Settings → Integrations." },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
