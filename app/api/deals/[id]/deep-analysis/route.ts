import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runDeepAnalysisForDeal } from "@/lib/services/entity/deepAnalysisOrchestrator";

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

  // Verify deal ownership before running
  const { data: deal } = await supabase
    .from("deals")
    .select("id, status")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Deep analysis is only available for deals that have been triaged or are investigating.
  // Passed deals are excluded — user must explicitly reopen the deal first.
  const allowedStatuses = ["triaged", "investigating", "loi", "acquired", "reviewing", "due_diligence", "offer"];
  if (!allowedStatuses.includes(deal.status)) {
    return NextResponse.json(
      { error: `Deep analysis is not available for deals with status "${deal.status}"` },
      { status: 422 }
    );
  }

  let trigger = "manual_run";
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.trigger === "string") trigger = body.trigger;
  } catch {
    // ignore — trigger is optional
  }

  const result = await runDeepAnalysisForDeal(dealId, user.id, trigger);

  if (!result.success && !result.snapshot_id) {
    return NextResponse.json(
      { error: result.error ?? "Deep analysis failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      snapshot_id: result.snapshot_id,
      facts_updated: result.facts_updated,
      deal_status_changed: result.deal_status_changed,
    },
    { status: 200 }
  );
}
