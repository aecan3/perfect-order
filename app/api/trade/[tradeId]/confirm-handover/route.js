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

  const body = await req.json().catch(() => ({}));
  const { confirmation } = body;

  if (confirmation !== "completed" && confirmation !== "did_not_happen") {
    return NextResponse.json(
      { error: "confirmation must be 'completed' or 'did_not_happen'" },
      { status: 400 }
    );
  }

  const { data: trade } = await supabase
    .from("trades")
    .select("proposer_id, recipient_id, status")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  const isProposer = trade.proposer_id === user.id;
  const isRecipient = trade.recipient_id === user.id;
  if (!isProposer && !isRecipient) {
    return NextResponse.json({ error: "Not a party to this trade" }, { status: 403 });
  }

  if (trade.status !== "agreed_pending_handover") {
    return NextResponse.json({ error: "Trade already resolved" }, { status: 400 });
  }

  const otherUserId = isProposer ? trade.recipient_id : trade.proposer_id;
  const { data: confirmerProfile } = await supabase
    .from("profiles")
    .select("handle, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const confirmerName = confirmerProfile?.display_name || `@${confirmerProfile?.handle}` || "Someone";

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", otherUserId)
    .maybeSingle();

  if (confirmation === "completed") {
    await supabase.from("trades").update({
      status: "physically_completed",
      physical_handover_confirmed_at: new Date().toISOString(),
    }).eq("id", tradeId);

    await supabase.from("trade_events").insert({
      trade_id: tradeId,
      user_id: user.id,
      event_type: "handover_confirmed",
      detail: { confirmed_by: isProposer ? "proposer" : "recipient" },
    });

    await supabase.from("notifications").insert({
      user_id: otherUserId,
      type: "trade_physically_completed",
      title: "Trade marked complete",
      body: `${confirmerName} confirmed the physical exchange happened.`,
      link: `/messages/${confirmerProfile?.handle || ""}`,
    });

    return NextResponse.json({ status: "physically_completed" });
  }

  // did_not_happen
  await supabase.from("trades").update({
    status: "cancelled",
    physical_handover_confirmed_at: new Date().toISOString(),
  }).eq("id", tradeId);

  await supabase.from("trade_events").insert({
    trade_id: tradeId,
    user_id: user.id,
    event_type: "handover_did_not_happen",
    detail: { reported_by: isProposer ? "proposer" : "recipient" },
  });

  await supabase.from("notifications").insert({
    user_id: otherUserId,
    type: "trade_cancelled",
    title: "Trade marked as not completed",
    body: `${confirmerName} reported the physical exchange didn't happen.`,
    link: `/messages/${confirmerProfile?.handle || ""}`,
  });

  return NextResponse.json({ status: "cancelled" });
}
