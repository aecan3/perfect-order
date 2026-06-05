import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function POST(req) {
  const anonClient = await getAnonClient();
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.cards) || body.cards.length === 0) {
    return NextResponse.json({ error: "Missing or empty cards array" }, { status: 400 });
  }

  for (const card of body.cards) {
    if (!card.printing_id || !card.set_id || card.card_number == null) {
      return NextResponse.json(
        { error: "Each card must have printing_id, set_id, card_number" },
        { status: 400 }
      );
    }
  }

  const { error } = await anonClient.rpc("commit_trade_cards", {
    p_user_id: user.id,
    p_cards:   body.cards,
  });

  if (error) {
    console.error("[commit] RPC error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[commit] committed", body.cards.length, "cards for user", user.id);
  return NextResponse.json({ committed: body.cards.length });
}
