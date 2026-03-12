/**
 * POST /api/deals/[id]/intake-reject
 *
 * Called after deal creation + initial scoring when the triage verdict is
 * PROBABLY_PASS. Marks the deal as intake_rejected, writes an audit log entry,
 * and queues Drive folder cleanup.
 *
 * Body:
 *   action: "reject" | "keep"
 *   rejection_reason?: string          (e.g. "PROBABLY_PASS")
 *   rejection_flags?: string[]         (specific flags from triage recommendation)
 *   score?: number                     (score at time of rejection)
 *   extracted_industry?: string
 *   extracted_location?: string
 *   extracted_price?: string
 *   extracted_sde?: string
 *   ai_summary_short?: string
 *
 * "reject" → sets intake_status = 'rejected', logs to intake_rejections,
 *            deletes Drive folder (non-fatal)
 * "keep"   → sets intake_status = 'promoted' (user chose "Keep anyway")
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getDealDisplayName } from "@/types";

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

  let body: {
    action: "reject" | "keep";
    rejection_reason?: string;
    rejection_flags?: string[];
    score?: number;
    extracted_industry?: string;
    extracted_location?: string;
    extracted_price?: string;
    extracted_sde?: string;
    ai_summary_short?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "reject" && body.action !== "keep") {
    return NextResponse.json({ error: "action must be 'reject' or 'keep'" }, { status: 422 });
  }

  // Verify deal ownership and get current state
  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, intake_status, google_drive_folder_id, created_at")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  // ── Keep anyway ───────────────────────────────────────────────────────────
  if (body.action === "keep") {
    await supabase
      .from("deals")
      .update({ intake_status: "promoted" })
      .eq("id", dealId)
      .eq("user_id", user.id);

    return NextResponse.json({ action: "kept", deal_id: dealId });
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  // 1. Mark deal as intake_rejected
  await supabase
    .from("deals")
    .update({ intake_status: "rejected" })
    .eq("id", dealId)
    .eq("user_id", user.id);

  // 2. Write audit log entry
  try {
    await supabase.from("intake_rejections").insert({
      deal_id: dealId,
      user_id: user.id,
      source_type: "intake",
      source_name: getDealDisplayName(deal),
      intake_created_at: deal.created_at as string,
      rejected_at: new Date().toISOString(),
      rejection_reason: body.rejection_reason ?? "PROBABLY_PASS",
      rejection_flags: body.rejection_flags ?? [],
      extracted_industry: body.extracted_industry ?? null,
      extracted_location: body.extracted_location ?? null,
      extracted_price: body.extracted_price ?? null,
      extracted_sde: body.extracted_sde ?? null,
      ai_summary_short: body.ai_summary_short ?? null,
      score_at_rejection: body.score !== undefined ? body.score : null,
    });
  } catch (auditErr) {
    console.error("[intake-reject] audit log failed (non-fatal):", auditErr);
  }

  // 3. Delete Drive folder (non-fatal — folder may not exist yet if Drive wasn't connected)
  const driveFolderId = deal.google_drive_folder_id as string | null;
  if (driveFolderId) {
    try {
      const { getAuthorizedDriveClient } = await import("@/lib/google/drive");
      const drive = await getAuthorizedDriveClient(user.id);
      // Trash the folder (soft delete — recoverable from Drive trash)
      await drive.files.update({
        fileId: driveFolderId,
        requestBody: { trashed: true },
      });
      // Clear the folder ID from the deal row
      await supabase
        .from("deals")
        .update({ google_drive_folder_id: null })
        .eq("id", dealId)
        .eq("user_id", user.id);
    } catch (driveErr) {
      console.warn("[intake-reject] Drive folder cleanup failed (non-fatal):", driveErr);
    }
  }

  return NextResponse.json({ action: "rejected", deal_id: dealId });
}
