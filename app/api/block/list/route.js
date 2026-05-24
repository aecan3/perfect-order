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

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_blocks")
    .select("id, blocked_id, reason, created_at, profiles!user_blocks_blocked_id_fkey(handle, display_name)")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[block/list] query failed:", error);
    return NextResponse.json({ error: "Failed to fetch blocked users" }, { status: 500 });
  }

  const blocks = (data || []).map((row) => ({
    id: row.id,
    blocked_id: row.blocked_id,
    handle: row.profiles?.handle ?? null,
    display_name: row.profiles?.display_name ?? null,
    reason: row.reason,
    created_at: row.created_at,
  }));

  return NextResponse.json({ blocks });
}
