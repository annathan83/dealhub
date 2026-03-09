import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { analyzeDealEntry } from "@/lib/ai/analyzeDealEntry";
import { saveRawEntryToDrive } from "@/lib/google/drive";
import { ingestFromDealEntry } from "@/lib/services/entity/entityFileService";
import type { Deal } from "@/types";

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

  let content: string;
  try {
    const body = await request.json();
    content = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("id, name, description")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const deal = dealData as Pick<Deal, "id" | "name" | "description">;

  // ── 1. Save raw entry ─────────────────────────────────────────────────────
  const { data: sourceData, error: sourceError } = await supabase
    .from("deal_sources")
    .insert({ deal_id: dealId, user_id: user.id, content })
    .select("id")
    .single();

  if (sourceError || !sourceData) {
    console.error("Failed to insert deal_source:", sourceError?.message);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }

  const sourceId = sourceData.id as string;

  // ── 2. Save to Google Drive (non-fatal) ───────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (tokenRow) {
    saveRawEntryToDrive({ userId: user.id, dealId, dealName: deal.name, rawContent: content })
      .catch((err) => console.error("Drive save failed (non-fatal):", err));
  }

  // ── 3. Entity pipeline: extract text → facts → KPI scoring (non-fatal) ───
  ingestFromDealEntry({
    dealId,
    userId: user.id,
    entryContent: content,
    entryTitle: null,
  }).catch((err) => console.error("[entity pipeline] ingestFromDealEntry failed:", err));

  // ── 4. AI analysis for the timeline entry ────────────────────────────────
  let analysis;
  try {
    analysis = await analyzeDealEntry({
      dealName: deal.name,
      dealDescription: deal.description,
      entryContent: content,
    });
  } catch (err) {
    console.error("AI analysis failed:", err);
    return NextResponse.json({ sourceId, analysisId: null }, { status: 201 });
  }

  // ── 5. Back-fill title + source_type ─────────────────────────────────────
  await supabase
    .from("deal_sources")
    .update({ title: analysis.generated_title, source_type: analysis.detected_type })
    .eq("id", sourceId);

  // ── 6. Save per-entry analysis to deal_source_analyses ───────────────────
  const { data: analysisData, error: analysisError } = await supabase
    .from("deal_source_analyses")
    .insert({
      deal_source_id: sourceId,
      deal_id: dealId,
      user_id: user.id,
      generated_title: analysis.generated_title,
      detected_type: analysis.detected_type,
      summary: analysis.summary,
      extracted_facts: analysis.extracted_facts,
      red_flags: analysis.red_flags,
      missing_information: analysis.missing_information,
      broker_questions: analysis.broker_questions,
    })
    .select("id")
    .single();

  if (analysisError) console.error("Failed to save analysis:", analysisError.message);

  // ── 7. Save change-log items ──────────────────────────────────────────────
  if (analysis.change_log_items.length > 0) {
    const logRows = analysis.change_log_items.map((item) => ({
      deal_id: dealId,
      deal_source_id: sourceId,
      user_id: user.id,
      change_type: item.change_type,
      title: item.title,
      description: item.description,
    }));
    supabase.from("deal_change_log").insert(logRows)
      .then(({ error }) => { if (error) console.error("change_log insert failed:", error.message); });
  }

  return NextResponse.json({ sourceId, analysisId: analysisData?.id ?? null }, { status: 201 });
}
