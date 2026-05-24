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

export async function POST(req) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { target_user_id, reason } = body;
  if (!target_user_id) return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 });
  if (target_user_id === user.id) return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", target_user_id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error: insertErr } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: target_user_id, reason });

  if (insertErr && insertErr.code !== "23505") {
    console.error("[block] insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to block user" }, { status: 500 });
  }

  const { error: deleteErr } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(user_a.eq.${user.id},user_b.eq.${target_user_id}),and(user_a.eq.${target_user_id},user_b.eq.${user.id})`
    );

  if (deleteErr) {
    console.error("[block] friendship delete failed:", deleteErr);
  }

  return NextResponse.json({ blocked: true });
}
