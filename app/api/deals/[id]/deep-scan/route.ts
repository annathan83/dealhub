/**
 * POST /api/deals/[id]/deep-scan
 *
 * Explicit premium/manual feature: resends the full extracted text corpus for
 * a deal to AI for a comprehensive fresh fact extraction pass.
 *
 * Unlike incremental revaluation (which processes only what changed), Deep Scan:
 *   1. Reads ALL file_text rows for the entity
 *   2. Runs extractFactsFromText with the full supported fact set
 *   3. Reconciles results — respects user_override facts
 *   4. Recalculates KPI scorecard
 *
 * This is intentionally separate from the normal incremental revaluation flow.
 * Use it when you want a complete fresh review from all source material.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runDeepScanForDeal } from "@/lib/services/facts/deepScanService";

export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
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

  const result = await runDeepScanForDeal(dealId, user.id);

  if (result.error === "Entity not found") {
    return NextResponse.json(
      { error: "Entity not found. Upload a document or paste text first." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: !result.error,
    entity_id: result.entity_id,
    files_processed: result.files_processed,
    facts_found: result.facts_found,
    facts_inserted: result.facts_inserted,
    facts_updated: result.facts_updated,
    conflicts_found: result.conflicts_found,
    error: result.error ?? null,
  });
}
