import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBlockIds } from "@/lib/queries/blocks";

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

export async function GET(request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q") || "";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 50);

  // Sanitize: only allow alphanumeric, spaces, hyphens, underscores
  const q = rawQ.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  const blockIds = await getBlockIds(supabase, user.id);

  // Search profiles by handle or display_name (exclude self)
  let profilesQuery = supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(limit);

  // Exclude blocked users (both directions)
  const blockedArray = Array.from(blockIds);
  if (blockedArray.length > 0) {
    profilesQuery = profilesQuery.not("id", "in", `(${blockedArray.join(",")})`);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    console.error("[friends/search] profiles query failed:", profilesError);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) return NextResponse.json({ results: [] });

  const ids = profiles.map((p) => p.id);

  // Fetch any existing friendship rows between current user and results
  const { data: friendshipRows, error: friendshipError } = await supabase
    .from("friendships")
    .select("user_a, user_b, status")
    .or(
      `and(user_a.eq.${user.id},user_b.in.(${ids.join(",")})),and(user_b.eq.${user.id},user_a.in.(${ids.join(",")}))`
    );

  if (friendshipError) {
    console.error("[friends/search] friendships query failed:", friendshipError);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  // Index friendship rows by the other user's id
  const friendshipByUserId = {};
  for (const row of friendshipRows || []) {
    const otherId = row.user_a === user.id ? row.user_b : row.user_a;
    friendshipByUserId[otherId] = row;
  }

  const results = profiles
    .filter((p) => {
      const row = friendshipByUserId[p.id];
      // Exclude users where we've already sent a pending request
      if (row && row.status === "pending" && row.user_a === user.id) {
        return false;
      }
      return true;
    })
    .map((p) => {
      const row = friendshipByUserId[p.id];
      let friendship_status = "not-friends";
      if (row) {
        if (row.status === "accepted") {
          friendship_status = "friends";
        } else if (row.status === "pending" && row.user_b === user.id) {
          friendship_status = "pending_received";
        }
      }
      return {
        id: p.id,
        handle: p.handle,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        friendship_status,
      };
    });

  return NextResponse.json({ results });
}
