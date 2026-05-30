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
  const acceptanceMode = body.acceptanceMode ?? "with_verification";

  const { data: trade } = await supabase
    .from("trades")
    .select("proposer_id, recipient_id, status, expires_at, proposer_offered_skip")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  if (new Date(trade.expires_at) < new Date()) {
    return NextResponse.json({ error: "This trade proposal has expired" }, { status: 410 });
  }

  const isProposer = trade.proposer_id === user.id;
  const isRecipient = trade.recipient_id === user.id;
  if (!isProposer && !isRecipient) return NextResponse.json({ error: "Not a party to this trade" }, { status: 403 });

  // --- Stage 1: recipient accepting the proposal ---
  if (trade.status === "pending") {
    if (!isRecipient) {
      return NextResponse.json({ error: "Only the recipient can accept a pending proposal" }, { status: 403 });
    }

    // Validate: acceptanceMode 'no_verification' is only valid when proposer offered skip
    if (acceptanceMode === "no_verification" && !trade.proposer_offered_skip) {
      return NextResponse.json({ error: "Cannot skip verification — proposer did not offer skip" }, { status: 400 });
    }

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("handle, display_name")
      .eq("id", user.id)
      .maybeSingle();
    const recipientName = recipientProfile?.display_name || `@${recipientProfile?.handle}` || "Someone";

    if (acceptanceMode === "no_verification") {
      // Trust-based path: pending → agreed_pending_handover
      await supabase.from("trades").update({
        status: "agreed_pending_handover",
        verification_skipped: true,
      }).eq("id", tradeId);

      await supabase.from("trade_events").insert({
        trade_id: tradeId,
        user_id: user.id,
        event_type: "recipient_accepted_no_verification",
        detail: {},
      });

      // Notify both parties
      const { data: proposerProfile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", trade.proposer_id)
        .maybeSingle();

      await supabase.from("notifications").insert([
        {
          user_id: trade.proposer_id,
          type: "trade_agreed_pending_handover",
          title: "Trade agreed — no verification",
          body: `${recipientName} accepted your trade without verification. Confirm when the physical exchange happens.`,
          link: `/messages/${recipientProfile?.handle || ""}`,
        },
        {
          user_id: trade.recipient_id,
          type: "trade_agreed_pending_handover",
          title: "Trade agreed — no verification",
          body: `You accepted a trade with @${proposerProfile?.handle || ""}. Confirm when the physical exchange happens.`,
          link: `/messages/${proposerProfile?.handle || ""}`,
        },
      ]);

      return NextResponse.json({ stage: "agreed_pending_handover" });
    }

    // Standard path: pending → verification_required
    await supabase.from("trades").update({ status: "verification_required" }).eq("id", tradeId);

    await supabase.from("trade_events").insert({
      trade_id: tradeId,
      user_id: user.id,
      event_type: "recipient_accepted",
      detail: {},
    });

    // If proposer offered skip but acceptor chose verification, notify proposer they need to upload
    if (trade.proposer_offered_skip) {
      await supabase.from("notifications").insert({
        user_id: trade.proposer_id,
        type: "trade_verification_required_by_acceptor",
        title: "Verification required",
        body: `${recipientName} accepted your trade and chose to verify. Please upload your photo.`,
        link: `/messages/${recipientProfile?.handle || ""}`,
      });
    } else {
      await supabase.from("notifications").insert({
        user_id: trade.proposer_id,
        type: "trade_accepted",
        title: "Trade accepted",
        body: `${recipientName} accepted your trade proposal.`,
        link: `/messages/${recipientProfile?.handle || ""}`,
      });
    }

    return NextResponse.json({ stage: "verification_required" });
  }

  // --- Stage 2: post-verification confirmation (verification_required → accepted) ---
  if (trade.status !== "verification_required") {
    return NextResponse.json({ error: "Trade is not in a state that can be accepted" }, { status: 400 });
  }

  const { data: verifications } = await supabase
    .from("trade_verifications")
    .select("user_id, confirmed")
    .eq("trade_id", tradeId);

  const proposerVerified = verifications?.some((v) => v.user_id === trade.proposer_id && v.confirmed);
  const recipientVerified = verifications?.some((v) => v.user_id === trade.recipient_id && v.confirmed);

  if (!proposerVerified || !recipientVerified) {
    return NextResponse.json({ error: "Both parties must complete photo verification first" }, { status: 400 });
  }

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
    await supabase.from("trades").update({ status: "accepted" }).eq("id", tradeId);
    try {
      const { data: files } = await supabase.storage.from("Card Photos").list(`verification/${tradeId}`);
      if (files?.length) {
        await supabase.storage.from("Card Photos").remove(files.map((f) => `verification/${tradeId}/${f.name}`));
      }
    } catch (err) {
      console.error("Photo cleanup failed (non-fatal):", err);
    }

    const [{ data: proposerProf }, { data: recipientProf }] = await Promise.all([
      supabase.from("profiles").select("handle").eq("id", trade.proposer_id).maybeSingle(),
      supabase.from("profiles").select("handle").eq("id", trade.recipient_id).maybeSingle(),
    ]);

    await supabase.from("notifications").insert([
      {
        user_id: trade.proposer_id,
        type: "trade_accepted",
        title: "Trade fully accepted",
        body: "Both parties have accepted. Ready for handover.",
        link: `/messages/${recipientProf?.handle || ""}`,
      },
      {
        user_id: trade.recipient_id,
        type: "trade_accepted",
        title: "Trade fully accepted",
        body: "Both parties have accepted. Ready for handover.",
        link: `/messages/${proposerProf?.handle || ""}`,
      },
    ]);

    return NextResponse.json({ bothAccepted: true });
  }

  return NextResponse.json({ bothAccepted: false });
}
