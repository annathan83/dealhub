/**
 * POST /api/deals/[id]/deep-scan
 *
 * Triggers a full fact extraction pass over all stored file_text for a deal entity.
 * Unlike the initial upload path (critical facts only), this extracts the full
 * supported fact set from already-stored extracted text — no re-upload needed.
 *
 * Behavior:
 *   1. Marks entity.deep_scan_status = 'running'
 *   2. Reads all file_text rows for the entity
 *   3. Runs extractFactsFromText with ALL fact definitions (not just critical)
 *   4. Reconciles results — respects manual_override facts
 *   5. Recalculates KPI scorecard
 *   6. Marks entity.deep_scan_status = 'completed' with stats
 *
 * This endpoint returns immediately with the scan result.
 * For large entities, consider making this async in a future iteration.
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
