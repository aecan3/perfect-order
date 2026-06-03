import { getFriendIds } from "@/lib/queries/friends";

// getDiscoverMatches — returns master-tier cards that friends have as duplicates
// which the viewer does NOT already own as that exact printing.
//
// WANTS MODEL: per-printing, not per-card-number. A viewer who has
// reverse-holofoil of a card will still see a friend's holofoil duplicate
// because they don't own that specific printing. The old checked=false logic
// used a (set_id:card_number) key fallback; that fallback is intentionally
// dropped here. With printings!inner on the friend query every result has a
// printing_id, so the per-printing check is sufficient and more useful.
//
// CALLER RESPONSIBILITY: pass friendIds pre-fetched via getFriendIds. The
// caller should early-return before calling this if friendIds is empty.

const MYHAVE_CAP = 50_000;

async function fetchAllOwnedPrintingIds(supabase, viewerUserId) {
  const PAGE_SIZE = 1000;
  const ids = [];
  let from = 0;
  let keepGoing = true;
  while (keepGoing) {
    const { data, error } = await supabase
      .from("collection_entries")
      .select("printing_id")
      .eq("user_id", viewerUserId)
      .eq("checked", true)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    for (const row of batch) {
      if (row.printing_id) ids.push(row.printing_id);
    }
    if (batch.length < PAGE_SIZE) keepGoing = false;
    else from += PAGE_SIZE;
    if (ids.length >= MYHAVE_CAP) {
      console.warn("Discover: myHave pagination exceeded 50k rows — investigate viewer collection size.");
      keepGoing = false;
    }
  }
  return ids;
}

async function fetchInFlightKeys(supabase, friendIds) {
  if (!friendIds.length) return new Set();

  const { data: activeTrades } = await supabase
    .from("trades")
    .select("id, proposer_id, recipient_id")
    .in("status", ["pending", "verification_required", "agreed_pending_handover"])
    .or(`proposer_id.in.(${friendIds.join(",")}),recipient_id.in.(${friendIds.join(",")})`);

  if (!activeTrades?.length) return new Set();

  const tradeIds = activeTrades.map((t) => t.id);
  const { data: activeItems } = await supabase
    .from("trade_items")
    .select("trade_id, side, printing_id")
    .in("trade_id", tradeIds);

  const tradeMap = Object.fromEntries(activeTrades.map((t) => [t.id, t]));
  const keys = new Set();
  for (const item of activeItems || []) {
    const trade = tradeMap[item.trade_id];
    if (!trade || !item.printing_id) continue;
    // Only hide the proposer's offered cards — recipient hasn't committed anything yet
    if (item.side !== "offer") continue;
    keys.add(`${trade.proposer_id}:${item.printing_id}`);
  }
  return keys;
}

export async function getDiscoverMatches({ supabase, viewerUserId, friendIds }) {
  const [{ data: friendEntries }, ownedPrintingIds] = await Promise.all([
    // Friends' master-tier cards with at least one spare copy
    supabase
      .from("collection_entries")
      .select("user_id, printing_id, card_number, set_id, duplicate_count, printing:printings!inner(price_usd, image_url, card:cards(name, image_large)), set:sets(name, code, logo_url)")
      .eq("printing.collection_tier", "master")
      .in("user_id", friendIds)
      .eq("checked", true)
      .or("duplicate_count.gt.0,trade_flagged.eq.true"),
    fetchAllOwnedPrintingIds(supabase, viewerUserId),
  ]);

  if ((friendEntries || []).length === 1000)
    console.warn("Discover: friend-entries hit 1000-row cap — results may be truncated. Consider tighter filters or explicit pagination as the friend network grows.");

  const myHavePrintingIds = new Set(ownedPrintingIds);

  // Keep only entries the viewer does not own as that exact printing
  const matched = (friendEntries || []).filter(
    (e) => e.printing_id && !myHavePrintingIds.has(e.printing_id)
  );

  // Exclude printings already committed to an active trade by the specific friend
  const inFlightKeys = await fetchInFlightKeys(supabase, friendIds);

  // Resolve handles for all matched friend user IDs in one batch
  const friendUserIds = [...new Set(matched.map((e) => e.user_id))];
  const { data: friendProfiles } = friendUserIds.length
    ? await supabase.from("profiles").select("id, handle").in("id", friendUserIds)
    : { data: [] };
  const profileMap = Object.fromEntries((friendProfiles || []).map((p) => [p.id, p]));

  return matched
    .filter((e) => !inFlightKeys.has(`${e.user_id}:${e.printing_id}`))
    .map((e) => ({
      printingId: e.printing_id,
      cardNumber: e.card_number,
      setId: e.set_id,
      setName: e.set?.name || "",
      setCode: e.set?.code || "",
      setLogoUrl: e.set?.logo_url || null,
      cardName: e.printing?.card?.name || "",
      friendHandle: profileMap[e.user_id]?.handle || "unknown",
      friendUserId: e.user_id,
      priceUsd: e.printing?.price_usd || 0,
      imageUrl: e.printing?.image_url || e.printing?.card?.image_large || null,
      duplicateCount: e.duplicate_count,
    }))
    .sort((a, b) => b.priceUsd - a.priceUsd);
}
