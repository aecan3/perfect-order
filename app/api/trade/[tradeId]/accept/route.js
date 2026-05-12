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
    .select("proposer_id, recipient_id, status, expires_at")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  if (new Date(trade.expires_at) < new Date()) {
    return NextResponse.json({ error: "This trade proposal has expired" }, { status: 410 });
  }

  const isProposer = trade.proposer_id === user.id;
  const isRecipient = trade.recipient_id === user.id;
  if (!isProposer && !isRecipient) return NextResponse.json({ error: "Not a party to this trade" }, { status: 403 });

  // Require both verifications confirmed
  const { data: verifications } = await supabase
    .from("trade_verifications")
    .select("user_id, confirmed")
    .eq("trade_id", tradeId);

  const proposerVerified = verifications?.some((v) => v.user_id === trade.proposer_id && v.confirmed);
  const recipientVerified = verifications?.some((v) => v.user_id === trade.recipient_id && v.confirmed);

  if (!proposerVerified || !recipientVerified) {
    return NextResponse.json({ error: "Both parties must complete photo verification first" }, { status: 400 });
  }

  // Check if already accepted by this user
  const { data: existingEvents } = await supabase
    .from("trade_events")
    .select("user_id, event_type")
    .eq("trade_id", tradeId)
    .eq("event_type", "accepted");

  const alreadyAccepted = existingEvents?.some((e) => e.user_id === user.id);
  if (!alreadyAccepted) {
    await supabase.from("trade_events").insert({
      trade_id: tradeId,
      user_id: user.id,
      event_type: "accepted",
      detail: { side: isProposer ? "proposer" : "recipient" },
    });
  }

  const otherUserId = isProposer ? trade.recipient_id : trade.proposer_id;
  const otherAccepted = existingEvents?.some((e) => e.user_id === otherUserId);

  if (otherAccepted) {
    // Both have accepted — mark trade as accepted
    await supabase.from("trades").update({ status: "accepted" }).eq("id", tradeId);
    return NextResponse.json({ bothAccepted: true });
  }

  return NextResponse.json({ bothAccepted: false });
}
