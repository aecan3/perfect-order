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
  console.log("[migration-api] received POST");
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[migration-api] no authenticated user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[migration-api] user:", user.id);

  const body = await request.json().catch((e) => {
    console.error("[migration-api] body parse failed:", e);
    return {};
  });
  const { entries } = body;
  console.log("[migration-api] entries count:", entries?.length);

  if (!Array.isArray(entries) || entries.length === 0) {
    console.warn("[migration-api] invalid or empty entries");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (entries.length > 500) {
    console.warn("[migration-api] too many entries:", entries.length);
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

  console.log("[migration-api] filtered rows count:", rows.length);
  if (rows.length > 0) {
    console.log("[migration-api] first row sample:", JSON.stringify(rows[0]));
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("collection_entries")
    .upsert(rows, {
      onConflict: "user_id,set_id,card_number,printing_id",
      ignoreDuplicates: true,
    })
    .select("printing_id");

  if (insertErr) {
    console.error("[migration-api] upsert failed:", JSON.stringify(insertErr));
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const setIds = [...new Set(rows.map((r) => r.set_id))];
  console.log("[migration-api] inserted:", inserted?.length, "of", rows.length, "setIds:", setIds);

  return NextResponse.json({
    inserted: inserted?.length || 0,
    requested: rows.length,
    setIds,
  });
}
