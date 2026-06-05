import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function DELETE(req) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.printing_id) {
    return NextResponse.json({ error: "Missing printing_id" }, { status: 400 });
  }

  // Only delete rows that are flagged-only (dup=0, trade_flagged=true).
  // Dupe-fed cards are owned collection entries and must not be removed here.
  const { error } = await supabase
    .from("collection_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("printing_id", body.printing_id)
    .eq("trade_flagged", true)
    .eq("duplicate_count", 0);

  if (error) {
    console.error("[binder-remove] delete failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
