import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// Public read — service role bypasses owner-only RLS
export async function GET(_req, { params }) {
  const { slug } = await params;
  const service = getServiceClient();

  const { data: list } = await service
    .from("want_lists")
    .select("id, created_at, title, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [{ data: profile }, { data: cards }] = await Promise.all([
    service.from("profiles").select("handle, display_name, avatar_url").eq("id", list.user_id).maybeSingle(),
    service.from("want_list_cards").select("id, set_id, card_number, printing_id, edition_label").eq("want_list_id", list.id).order("id"),
  ]);

  if (!cards) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Join printings for current image/price — two-query split per CLAUDE.md
  const printingIds = [...new Set(cards.map(c => c.printing_id))];
  const { data: printings } = await service
    .from("printings")
    .select("id, image_url, price_usd")
    .in("id", printingIds);

  const printingMap = Object.fromEntries((printings || []).map(p => [p.id, p]));

  return NextResponse.json({
    slug,
    created_at: list.created_at,
    title: list.title,
    owner: profile || null,
    cards: cards.map(c => ({
      ...c,
      image_url: printingMap[c.printing_id]?.image_url ?? null,
      price_usd: printingMap[c.printing_id]?.price_usd ?? null,
    })),
  });
}

// Owner delete — authed client, RLS enforces ownership
export async function DELETE(_req, { params }) {
  const { slug } = await params;
  const supabase = await getAnonClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error, count } = await supabase
    .from("want_lists")
    .delete({ count: "exact" })
    .eq("slug", slug)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new Response(null, { status: 204 });
}
