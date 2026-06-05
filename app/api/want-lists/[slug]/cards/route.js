import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

export async function POST(req, { params }) {
  const anonClient = await getAnonClient();
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const service = getServiceClient();

  const { data: list } = await service
    .from("want_lists")
    .select("id, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (list.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  // Reject unknown printing_ids
  const uniquePrintingIds = [...new Set(cards.map(c => c.printing_id))];
  const { data: foundPrintings } = await service
    .from("printings")
    .select("id")
    .in("id", uniquePrintingIds);
  if ((foundPrintings?.length ?? 0) !== uniquePrintingIds.length) {
    return NextResponse.json({ error: "unknown printing_id" }, { status: 400 });
  }

  // Fetch existing cards for server-side dedup + total cap check
  const { data: existingCards } = await service
    .from("want_list_cards")
    .select("printing_id")
    .eq("want_list_id", list.id);

  const existingPrintingIds = new Set((existingCards || []).map(c => c.printing_id));
  const existingCount = existingCards?.length ?? 0;

  // Dedup: drop cards already in the list
  const newCards = cards.filter(c => !existingPrintingIds.has(c.printing_id));

  // Total cap
  if (existingCount + newCards.length > 500) {
    return NextResponse.json({ error: "total would exceed 500-card limit" }, { status: 400 });
  }

  if (newCards.length === 0) {
    return NextResponse.json({ added: 0 });
  }

  const { error: insertErr } = await service
    .from("want_list_cards")
    .insert(newCards.map(c => ({
      want_list_id: list.id,
      set_id: c.set_id,
      card_number: c.card_number,
      printing_id: c.printing_id,
      edition_label: c.edition_label,
    })));

  if (insertErr) {
    Sentry.captureMessage("[want-lists/cards] insert failed", {
      level: "error",
      extra: { slug, userId: user.id, error: insertErr.message },
    });
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ added: newCards.length });
}
