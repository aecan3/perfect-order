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

  const body = await req.json();
  const { recipientHandle, offerItems, requestItems: rawRequestItems, requestItem, skipVerification } = body;

  // Accept either an array (new Discover flow) or a single item (legacy friend-set flow)
  const requestItems = rawRequestItems?.length ? rawRequestItems : (requestItem ? [requestItem] : []);

  if (!recipientHandle || !requestItems.length || !offerItems?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: recipient } = await supabase
    .from("profiles")
    .select("id, display_name, handle")
    .eq("handle", recipientHandle)
    .maybeSingle();

  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(user_a.eq.${user.id},user_b.eq.${recipient.id}),and(user_a.eq.${recipient.id},user_b.eq.${user.id})`
    )
    .eq("status", "accepted")
    .maybeSingle();

  if (!friendship) return NextResponse.json({ error: "Not friends" }, { status: 403 });

  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .insert({ proposer_id: user.id, recipient_id: recipient.id, proposer_offered_skip: skipVerification === true })
    .select("id")
    .single();

  if (tradeErr) return NextResponse.json({ error: tradeErr.message }, { status: 500 });

  const tradeId = trade.id;

  const items = [
    ...offerItems.map((item) => ({ trade_id: tradeId, side: "offer", ...item })),
    ...requestItems.map((item) => ({ trade_id: tradeId, side: "request", ...item })),
  ];

  const { error: itemsErr } = await supabase.from("trade_items").insert(items);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  await supabase.from("trade_events").insert({
    trade_id: tradeId,
    user_id: user.id,
    event_type: "proposed",
    detail: { offer_count: offerItems.length },
  });

  const offerTotal = offerItems.reduce((s, i) => s + (Number(i.price_usd) || 0), 0);
  const requestTotal = requestItems.reduce((s, i) => s + (Number(i.price_usd) || 0), 0);

  const requestNames = requestItems.map((i) => i.card_name).join(", ");
  const messageBody = `Trade proposal: ${offerItems.map((i) => i.card_name).join(", ")} for ${requestNames}`;

  const cards = [
    ...offerItems.map((i) => ({
      side: "offer",
      printing_id: i.printing_id,
      card_name: i.card_name,
      set_name: i.set_name,
      image_url: i.image_url,
      price_usd: i.price_usd,
      printing_label: i.printing_label,
    })),
    ...requestItems.map((i) => ({
      side: "request",
      printing_id: i.printing_id,
      card_name: i.card_name,
      set_name: i.set_name,
      image_url: i.image_url,
      price_usd: i.price_usd,
      printing_label: i.printing_label,
    })),
  ];

  await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipient.id,
    body: messageBody,
    message_type: "trade_proposal",
    metadata: {
      trade_id: tradeId,
      offer_total: offerTotal,
      request_total: requestTotal,
      cards,
    },
  });

  const { data: proposerProfile } = await supabase
    .from("profiles")
    .select("handle, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const senderName = proposerProfile?.display_name || `@${proposerProfile?.handle}` || "Someone";
  await supabase.from("notifications").insert({
    user_id: recipient.id,
    type: "trade_proposal",
    title: "New trade proposal",
    body: `${senderName} wants to trade with you.`,
    link: `/messages/${proposerProfile?.handle || ""}`,
  });

  return NextResponse.json({ tradeId });
}
