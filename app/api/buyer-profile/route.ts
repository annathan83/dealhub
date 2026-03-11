import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET — fetch current user's buyer profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("buyer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

// POST — upsert buyer profile
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;

  const { data, error } = await supabase
    .from("buyer_profiles")
    .upsert({
      user_id: user.id,
      preferred_industries:              body.preferred_industries ?? [],
      excluded_industries:               body.excluded_industries ?? [],
      target_sde_min:                    body.target_sde_min ?? null,
      target_sde_max:                    body.target_sde_max ?? null,
      target_purchase_price_min:         body.target_purchase_price_min ?? null,
      target_purchase_price_max:         body.target_purchase_price_max ?? null,
      preferred_locations:               body.preferred_locations ?? [],
      max_employees:                     body.max_employees ?? null,
      manager_required:                  body.manager_required ?? null,
      owner_operator_ok:                 body.owner_operator_ok ?? null,
      preferred_business_characteristics: body.preferred_business_characteristics ?? null,
      experience_background:             body.experience_background ?? null,
      acquisition_goals:                 body.acquisition_goals ?? null,
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}
