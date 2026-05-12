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

export async function POST(req, { params }) {
  const { tradeId } = await params;

  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trade } = await supabase
    .from("trades")
    .select("proposer_id, recipient_id, status")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  if (trade.recipient_id !== user.id) {
    return NextResponse.json({ error: "Only the recipient can decline a trade" }, { status: 403 });
  }
  if (trade.status !== "pending") {
    return NextResponse.json({ error: "Trade can only be declined while pending" }, { status: 400 });
  }

  await supabase.from("trades").update({ status: "declined" }).eq("id", tradeId);
  await supabase.from("trade_events").insert({
    trade_id: tradeId,
    user_id: user.id,
    event_type: "trade_declined",
    detail: {},
  });

  try {
    const { data: files } = await supabase.storage.from("Card Photos").list(`verification/${tradeId}`);
    if (files?.length) {
      await supabase.storage.from("Card Photos").remove(files.map((f) => `verification/${tradeId}/${f.name}`));
    }
  } catch (err) {
    console.error("Photo cleanup failed (non-fatal):", err);
  }

  return NextResponse.json({ declined: true });
}
