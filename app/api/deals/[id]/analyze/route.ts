/**
 * POST /api/deals/[id]/analyze
 *
 * Triggers a deal-level analysis run.
 * Creates an immutable deal_analysis_runs record, processes pending derivatives,
 * generates a deal_opinions row, and updates deals.current_opinion_id.
 *
 * Body (optional JSON):
 *   { "triggering_file_ids": ["uuid", ...] }
 *
 * Returns:
 *   { run_id, opinion_id, status }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runDealAnalysis } from "@/lib/services/DealAnalysisRunService";

export const maxDuration = 60;

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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Verify deal ownership ─────────────────────────────────────────────────
  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // ── Parse optional body ───────────────────────────────────────────────────
  let triggeringFileIds: string[] = [];
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.triggering_file_ids)) {
      triggeringFileIds = body.triggering_file_ids.filter(
        (id: unknown) => typeof id === "string"
      );
    }
  } catch {
    // Body is optional — ignore parse errors
  }

  // ── Run analysis ──────────────────────────────────────────────────────────
  try {
    const { run, opinion } = await runDealAnalysis({
      dealId,
      userId: user.id,
      triggeredBy: "manual",
      triggeringFileIds,
    });

    return NextResponse.json(
      {
        run_id: run.id,
        opinion_id: opinion.id,
        status: run.status,
        ai_deal_score: opinion.ai_deal_score,
        ai_verdict: opinion.ai_verdict,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[analyze route] runDealAnalysis failed:", err);
    return NextResponse.json(
      { error: "Analysis run failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
