import { getServiceClient } from "@/lib/supabase/service";
import { searchBuyItNow } from "@/lib/ebay/browse";
import { matchListing } from "@/lib/marketplace/match";

/**
 * Fetch and upsert fresh BIN listings for a single printing.
 * Deletes listings whose source_listing_id wasn't returned this fetch (sold/expired).
 *
 * @param {string} printingId
 * @param {string} marketplaceId  e.g. "EBAY_AU"
 * @returns {{ upserted: number, deleted: number }}
 */
export async function refreshListingsForPrinting(printingId, marketplaceId = "EBAY_AU") {
  const supabase = getServiceClient();

  // Two separate queries — avoids PostgREST embed ambiguity (cards also has set_id→sets FK)
  const { data: printing, error: printingErr } = await supabase
    .from("printings")
    .select("id, set_id, card_number, card:cards(name)")
    .eq("id", printingId)
    .single();

  if (printingErr || !printing) {
    throw new Error(`refreshListingsForPrinting: printing "${printingId}" not found — ${printingErr?.message}`);
  }

  const { data: set, error: setErr } = await supabase
    .from("sets")
    .select("total")
    .eq("id", printing.set_id)
    .single();

  if (setErr || !set) {
    throw new Error(`refreshListingsForPrinting: set "${printing.set_id}" not found — ${setErr?.message}`);
  }

  const cardName  = printing.card?.name;
  const setTotal  = set.total;
  const setId     = printing.set_id;
  const cardNum   = printing.card_number;

  if (!cardName || !setTotal || !cardNum) {
    throw new Error(`refreshListingsForPrinting: incomplete data for "${printingId}" (cardName=${cardName}, cardNum=${cardNum}, setTotal=${setTotal})`);
  }

  const query = `${cardName} ${cardNum}/${setTotal} pokemon tcg`;

  const candidate = {
    printing_id: printing.id,
    set_id:      setId,
    card_number: cardNum,
    card_name:   cardName,
    set_total:   setTotal,
  };

  let rawListings;
  try {
    rawListings = await searchBuyItNow({ query, marketplaceId });
  } catch (err) {
    throw new Error(`refreshListingsForPrinting: eBay search failed — ${err.message}`);
  }

  // Match and normalise
  const matched = [];
  for (const listing of rawListings) {
    const match = matchListing(listing.title, [candidate]);
    if (!match) continue;
    if ((listing.condition || "").toLowerCase() === "graded") continue;
    matched.push({
      source:              "ebay",
      source_listing_id:   listing.sourceListingId,
      printing_id:         printingId,
      set_id:              setId,
      card_number:         cardNum,
      title:               listing.title,
      price_amount:        listing.price?.amount   ?? null,
      price_currency:      listing.price?.currency ?? null,
      image_url:           listing.imageUrl,
      listing_url:         listing.listingUrl,
      seller_username:     listing.seller?.username    ?? null,
      seller_feedback_pct: listing.seller?.feedbackPct ?? null,
      condition:           listing.condition,
      marketplace_id:      marketplaceId,
      fetched_at:          new Date().toISOString(),
    });
  }

  // Upsert — PK (source, source_listing_id) means re-fetches update in place
  let upserted = 0;
  if (matched.length > 0) {
    const { error: upsertErr } = await supabase
      .from("marketplace_listings")
      .upsert(matched, { onConflict: "source,source_listing_id" });
    if (upsertErr) throw new Error(`refreshListingsForPrinting: upsert failed — ${upsertErr.message}`);
    upserted = matched.length;
  }

  // Delete listings for this printing that weren't in the latest fetch
  const freshIds = matched.map((r) => r.source_listing_id);
  let deleted = 0;
  if (freshIds.length > 0) {
    const { error: deleteErr, count } = await supabase
      .from("marketplace_listings")
      .delete({ count: "exact" })
      .eq("printing_id", printingId)
      .eq("source", "ebay")
      .eq("marketplace_id", marketplaceId)
      .not("source_listing_id", "in", `(${freshIds.map((id) => `"${id}"`).join(",")})`);
    if (deleteErr) throw new Error(`refreshListingsForPrinting: delete stale failed — ${deleteErr.message}`);
    deleted = count ?? 0;
  } else {
    // No matches at all — clear all existing listings for this printing
    const { error: deleteErr, count } = await supabase
      .from("marketplace_listings")
      .delete({ count: "exact" })
      .eq("printing_id", printingId)
      .eq("source", "ebay")
      .eq("marketplace_id", marketplaceId);
    if (deleteErr) throw new Error(`refreshListingsForPrinting: delete all stale failed — ${deleteErr.message}`);
    deleted = count ?? 0;
  }

  return { upserted, deleted };
}
