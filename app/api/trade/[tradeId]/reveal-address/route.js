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
  if (trade.status !== "accepted") return NextResponse.json({ error: "Trade not yet accepted by both parties" }, { status: 400 });

  const isProposer = trade.proposer_id === user.id;
  const isRecipient = trade.recipient_id === user.id;
  if (!isProposer && !isRecipient) return NextResponse.json({ error: "Not a party to this trade" }, { status: 403 });

  const otherUserId = isProposer ? trade.recipient_id : trade.proposer_id;

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("display_name, handle, mailing_address")
    .eq("id", otherUserId)
    .maybeSingle();

  if (!otherProfile?.mailing_address) {
    return NextResponse.json({ error: "no_address", displayName: otherProfile?.display_name }, { status: 404 });
  }

  await supabase.from("trade_events").insert({
    trade_id: tradeId,
    user_id: user.id,
    event_type: "address_revealed",
    detail: { revealed_to: user.id },
  });

  return NextResponse.json({
    address: otherProfile.mailing_address,
    displayName: otherProfile.display_name,
    handle: otherProfile.handle,
  });
}
