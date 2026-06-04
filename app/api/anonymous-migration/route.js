import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function POST(request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { entries, setModes } = body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (entries.length > 500) {
    return NextResponse.json({ error: "Too many entries" }, { status: 400 });
  }

  const rows = entries
    .filter((e) => e.printingId && e.cardNumber !== undefined && e.setId && typeof e.quantity === "number" && e.quantity > 0)
    .map((e) => ({
      user_id: user.id,
      printing_id: e.printingId,
      card_number: e.cardNumber,
      set_id: e.setId,
      checked: true,
      duplicate_count: e.quantity > 1 ? e.quantity - 1 : 0,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, requested: 0, setIds: [] });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("collection_entries")
    .upsert(rows, {
      onConflict: "user_id,set_id,card_number,printing_id",
      ignoreDuplicates: true,
    })
    .select("printing_id");

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const setIds = [...new Set(rows.map((r) => r.set_id))];

  // Ensure a user_sets row exists for each migrated set so it appears in MY SETS.
  // added_at defaults to now(); prices_updated_at and previous_value are populated
  // later by the price refresh cron. ignoreDuplicates = safe to re-run.
  const VALID_MODES = new Set(["any", "all", "first_edition", "unlimited", "shadowless"]);
  const userSetsRows = setIds.map((setId) => {
    const mode = setModes?.[setId];
    return {
      user_id: user.id,
      set_id: setId,
      hidden_at: null,
      edition_mode: (mode && VALID_MODES.has(mode)) ? mode : "any",
    };
  });

  const { error: userSetsErr } = await supabase
    .from("user_sets")
    .upsert(userSetsRows, {
      onConflict: "user_id,set_id",
      ignoreDuplicates: true,
    });

  if (userSetsErr) {
    console.error("[migration] user_sets upsert failed:", JSON.stringify(userSetsErr));
    // Don't fail the whole migration — collection_entries succeeded.
    // Worst case: user sees empty MY SETS but cards exist and can re-add the set.
  }

  return NextResponse.json({
    inserted: inserted?.length || 0,
    requested: rows.length,
    setIds,
  });
}
