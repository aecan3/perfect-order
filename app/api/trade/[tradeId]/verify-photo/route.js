import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

  const { imageBase64, cardName, setName } = await req.json();
  if (!imageBase64 || !cardName) {
    return NextResponse.json({ error: "Missing imageBase64 or cardName" }, { status: 400 });
  }

  // Load trade to determine side and verify user is a party
  const { data: trade } = await supabase
    .from("trades")
    .select("proposer_id, recipient_id, expires_at")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  if (new Date(trade.expires_at) < new Date()) {
    return NextResponse.json({ error: "This trade proposal has expired" }, { status: 410 });
  }

  const isProposer = trade.proposer_id === user.id;
  const isRecipient = trade.recipient_id === user.id;
  if (!isProposer && !isRecipient) return NextResponse.json({ error: "Not a party to this trade" }, { status: 403 });

  const side = isProposer ? "proposer" : "recipient";

  // Strip data URL prefix for Anthropic
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let aiResult;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64Data },
            },
            {
              type: "text",
              text: `You are verifying a trading card photo for a peer-to-peer trade.
Examine this image and confirm ALL of the following:
1. This appears to be a live photo of a physical card, not a screenshot, scan, or photo of a screen
2. A Pokemon trading card is clearly visible
3. The card visible matches the name "${cardName}" from the set "${setName}"

Respond in JSON only:
{
  "livePhoto": true/false,
  "cardVisible": true/false,
  "cardMatches": true/false,
  "confidence": "high/medium/low",
  "failureReason": "string or null"
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (err) {
    return NextResponse.json({ error: "AI verification failed: " + err.message }, { status: 500 });
  }

  if (!aiResult) {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }

  const confirmed =
    aiResult.livePhoto === true &&
    aiResult.cardVisible === true &&
    aiResult.cardMatches === true &&
    aiResult.confidence !== "low";

  if (!confirmed) {
    return NextResponse.json({ confirmed: false, aiResult });
  }

  // Store verification
  const { error: upsertErr } = await supabase
    .from("trade_verifications")
    .upsert(
      { trade_id: tradeId, user_id: user.id, side, confirmed: true, ai_result: aiResult },
      { onConflict: "trade_id,user_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Log event
  await supabase.from("trade_events").insert({
    trade_id: tradeId,
    user_id: user.id,
    event_type: "photo_verified",
    detail: { side, confidence: aiResult.confidence },
  });

  return NextResponse.json({ confirmed: true, aiResult });
}
