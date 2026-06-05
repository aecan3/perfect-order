import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/lib/supabase/service";
import * as Sentry from "@sentry/nextjs";

const LABEL_RE = /^[A-Za-z0-9'· ]{1,40}$/;

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function POST(req) {
  const supabase = await getAnonClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const cards = body?.cards;

  if (!Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: "cards required" }, { status: 400 });
  }
  if (cards.length > 500) {
    return NextResponse.json({ error: "too many cards (max 500)" }, { status: 400 });
  }
  for (const c of cards) {
    if (!c.set_id || !Number.isInteger(c.card_number) || !c.printing_id || !c.edition_label) {
      return NextResponse.json({ error: "invalid card shape" }, { status: 400 });
    }
    if (!LABEL_RE.test(c.edition_label)) {
      return NextResponse.json({ error: "invalid edition_label" }, { status: 400 });
    }
  }

  // Reject unknown printing_ids — prevents arbitrary content on the public page
  const uniquePrintingIds = [...new Set(cards.map(c => c.printing_id))];
  const { data: foundPrintings } = await getServiceClient()
    .from("printings")
    .select("id")
    .in("id", uniquePrintingIds);
  if ((foundPrintings?.length ?? 0) !== uniquePrintingIds.length) {
    return NextResponse.json({ error: "unknown printing_id" }, { status: 400 });
  }

  const slug = randomBytes(6).toString("base64url");

  const { data: list, error: listErr } = await supabase
    .from("want_lists")
    .insert({ user_id: user.id, slug })
    .select("id")
    .single();

  if (listErr) {
    Sentry.captureMessage("[want-lists] creation failed — insert list", {
      level: "error",
      extra: { userId: user.id, cardCount: cards.length, error: listErr.message },
    });
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const { error: cardsErr } = await supabase
    .from("want_list_cards")
    .insert(cards.map(c => ({
      want_list_id: list.id,
      set_id: c.set_id,
      card_number: c.card_number,
      printing_id: c.printing_id,
      edition_label: c.edition_label,
    })));

  if (cardsErr) {
    await supabase.from("want_lists").delete().eq("id", list.id);
    Sentry.captureMessage("[want-lists] creation failed — insert cards", {
      level: "error",
      extra: { userId: user.id, cardCount: cards.length, error: cardsErr.message },
    });
    return NextResponse.json({ error: cardsErr.message }, { status: 500 });
  }

  return NextResponse.json({ slug });
}
