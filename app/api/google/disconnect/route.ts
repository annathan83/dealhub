import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete both the OAuth tokens and the drive connection row
  await supabase.from("google_oauth_tokens").delete().eq("user_id", user.id);
  await supabase.from("google_drive_connections").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
