import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

async function getAnonClient() {
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

export async function GET(request, { params }) {
  // No auth gate — stats are public (counts only, no underlying rows).
  // Anon users get mutual_count=0; logged-in users get real mutual count.
  const anonClient = await getAnonClient();
  const { data: { user } } = await anonClient.auth.getUser();

  const { handle } = await params;
  const service = getServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetId = profile.id;
  const requesterId = user?.id ?? null;

  const [
    { count: setsCount },
    { data: cardsCount },
    { count: dupesCount },
    { count: huntingCount },
    { data: requesterFriendships },
    { data: targetFriendships },
  ] = await Promise.all([
    service
      .from("user_sets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetId),
    service.rpc("get_cards_count", { p_user_id: targetId }),
    service
      .from("collection_entries")
      .select("printing:printings!inner(collection_tier)", { count: "exact", head: true })
      .eq("user_id", targetId)
      .eq("checked", true)
      .or("duplicate_count.gt.0,trade_flagged.eq.true")
      .eq("printing.collection_tier", "master"),
    service
      .from("favourites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetId),
    requesterId
      ? service.from("friendships").select("user_a, user_b")
          .or(`user_a.eq.${requesterId},user_b.eq.${requesterId}`)
          .eq("status", "accepted")
      : Promise.resolve({ data: [] }),
    requesterId
      ? service.from("friendships").select("user_a, user_b")
          .or(`user_a.eq.${targetId},user_b.eq.${targetId}`)
          .eq("status", "accepted")
      : Promise.resolve({ data: [] }),
  ]);

  const requesterFriendIds = new Set(
    (requesterFriendships || []).map(f => f.user_a === requesterId ? f.user_b : f.user_a)
  );
  const mutualCount = (targetFriendships || []).filter(f => {
    const otherId = f.user_a === targetId ? f.user_b : f.user_a;
    return requesterFriendIds.has(otherId);
  }).length;

  return NextResponse.json({
    stats: {
      sets: setsCount || 0,
      cards: cardsCount || 0,
      duplicates: dupesCount || 0,
    },
    hunting_count: huntingCount || 0,
    mutual_count: mutualCount,
  });
}
