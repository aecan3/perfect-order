import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { MSShell } from "@/components/chrome/MSShell";
import { WantListView } from "./WantListView";

export default async function WantListPage({ params }) {
  const { slug } = await params;
  const service = getServiceClient();

  const { data: list } = await service
    .from("want_lists")
    .select("id, created_at, title, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!list) notFound();

  // Detect owner for edit affordances
  const cookieStore = await cookies();
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  const isOwner = user?.id === list.user_id;

  const [{ data: profile }, { data: cards }] = await Promise.all([
    service.from("profiles").select("handle, display_name").eq("id", list.user_id).maybeSingle(),
    service.from("want_list_cards").select("id, set_id, card_number, printing_id, edition_label").eq("want_list_id", list.id).order("id"),
  ]);

  if (!cards) notFound();

  const printingIds = [...new Set(cards.map(c => c.printing_id))];
  const { data: printings } = await service
    .from("printings")
    .select("id, price_usd, card:cards(image_large, name)")
    .in("id", printingIds);

  const printingMap = Object.fromEntries((printings || []).map(p => [p.id, p]));

  const enriched = cards.map(c => ({
    ...c,
    image_url: printingMap[c.printing_id]?.card?.image_large ?? null,
    price_usd: printingMap[c.printing_id]?.price_usd ?? null,
    card_name: printingMap[c.printing_id]?.card?.name ?? null,
  }));

  const dateStr = new Date(list.created_at).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
  const ownerName = profile?.display_name || profile?.handle || "Someone";

  return (
    <MSShell anonymousNav={!user}>
      <WantListView
        initialCards={enriched}
        isOwner={isOwner}
        listId={list.id}
        slug={slug}
        initialTitle={list.title}
        ownerName={ownerName}
        dateStr={dateStr}
      />
    </MSShell>
  );
}
