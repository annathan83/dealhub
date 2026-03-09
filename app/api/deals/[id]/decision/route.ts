import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { PassReason } from "@/types";

type DecisionAction = "pass" | "keep_investigating";

type PassPayload = {
  action: "pass";
  pass_reason?: PassReason | null;
  pass_note?: string | null;
  delete_deal?: boolean;
};

type KeepPayload = {
  action: "keep_investigating";
};

type DecisionPayload = PassPayload | KeepPayload;

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

  let body: DecisionPayload;
  try {
    body = await request.json() as DecisionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action: DecisionAction = body.action;
  if (action !== "pass" && action !== "keep_investigating") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Verify the deal belongs to this user
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, status")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // ── Pass ──────────────────────────────────────────────────────────────────
  if (action === "pass") {
    const passPayload = body as PassPayload;

    if (passPayload.delete_deal) {
      // Hard delete — cascades to all child records via FK constraints
      const { error: deleteError } = await supabase
        .from("deals")
        .delete()
        .eq("id", dealId)
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("[decision] delete failed:", deleteError.message);
        return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
      }

      return NextResponse.json({ action: "deleted", deal_id: dealId }, { status: 200 });
    }

    // Archive as passed
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        status: "passed",
        pass_reason: passPayload.pass_reason ?? null,
        pass_note: passPayload.pass_note ?? null,
        passed_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[decision] pass update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to archive deal" }, { status: 500 });
    }

    return NextResponse.json({ action: "passed", deal_id: dealId }, { status: 200 });
  }

  // ── Keep Investigating ────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("deals")
    .update({ status: "active" })
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[decision] keep_investigating update failed:", updateError.message);
    return NextResponse.json({ error: "Failed to update deal status" }, { status: 500 });
  }

  return NextResponse.json({ action: "investigating", deal_id: dealId }, { status: 200 });
}
