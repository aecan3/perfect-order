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
  console.log("[migration:api] user:", user?.id ?? "null (unauthorized)");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { entries: rawEntries = [] } = body;
  console.log("[migration:api] rawEntries received:", rawEntries.length, "first:", rawEntries[0] ?? null);

  const entries = rawEntries
    .filter(
      (e) =>
        e.printingId &&
        e.cardNumber !== undefined &&
        e.cardNumber !== null &&
        e.setId &&
        typeof e.quantity === "number" &&
        e.quantity > 0
    )
    .slice(0, 500);

  console.log("[migration:api] entries after filter:", entries.length);

  if (entries.length === 0) {
    console.log("[migration:api] zero entries after filter — returning early");
    return NextResponse.json({ inserted: 0, requested: 0, setIds: [] });
  }

  const rows = entries.map((e) => ({
    user_id: user.id,
    printing_id: e.printingId,
    card_number: e.cardNumber,
    set_id: e.setId,
    checked: true,
    duplicate_count: Math.max(0, e.quantity - 1),
    updated_at: new Date().toISOString(),
  }));

  console.log("[migration:api] upserting", rows.length, "rows, sample:", rows[0]);

  const { data: inserted, error } = await supabase
    .from("collection_entries")
    .upsert(rows, {
      onConflict: "user_id,set_id,card_number,printing_id",
      ignoreDuplicates: true,
    })
    .select("printing_id");

  console.log("[migration:api] upsert complete — inserted:", inserted?.length ?? 0, "error:", error?.message ?? null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const setIds = [...new Set(entries.map((e) => e.setId))];

  return NextResponse.json({
    inserted: inserted?.length ?? 0,
    requested: entries.length,
    setIds,
  });
}
