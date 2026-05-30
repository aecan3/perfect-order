import { getFreshListingsForPrintings } from "@/lib/marketplace/fetch";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * Fetch cached listings for a user's target printings, pick a varied
 * subset (max N per printing, prefer different sellers then price points),
 * and join to printings+cards to attach card_image_large and card_name.
 */
export async function getListingsForUser(targetPrintingIds, {
  marketplaceId = "EBAY_AU",
  maxAgeMinutes = 480,
  perPrintingLimit = 3,
} = {}) {
  if (!targetPrintingIds.length) return { listings: [] };

  const { fresh } = await getFreshListingsForPrintings(targetPrintingIds, {
    marketplaceId,
    maxAgeMinutes,
  });
  if (!fresh.length) return { listings: [] };

  // Group by printing_id
  const byPrinting = new Map();
  for (const row of fresh) {
    if (!byPrinting.has(row.printing_id)) byPrinting.set(row.printing_id, []);
    byPrinting.get(row.printing_id).push(row);
  }

  // Pick varied subset per printing
  const picked = [];
  for (const [, rows] of byPrinting) {
    picked.push(...pickVariety(rows, perPrintingLimit));
  }

  // Two-query join: printings → cards (avoids PostgREST FK-ambiguity —
  // both printings and cards have a set_id FK to sets)
  const supabase = getServiceClient();
  const uniquePrintingIds = [...new Set(picked.map((r) => r.printing_id))];

  const { data: printings, error: pErr } = await supabase
    .from("printings")
    .select("id, card_id, set_id")
    .in("id", uniquePrintingIds);
  if (pErr) throw new Error(`getListingsForUser printings lookup: ${pErr.message}`);

  const cardIds = [...new Set(printings.map((p) => p.card_id))];
  const { data: cards, error: cErr } = await supabase
    .from("cards")
    .select("id, name, image_large")
    .in("id", cardIds);
  if (cErr) throw new Error(`getListingsForUser cards lookup: ${cErr.message}`);

  const setIds = [...new Set(printings.map((p) => p.set_id).filter(Boolean))];
  const { data: sets, error: sErr } = await supabase
    .from("sets")
    .select("id, name, logo_url")
    .in("id", setIds);
  if (sErr) throw new Error(`getListingsForUser sets lookup: ${sErr.message}`);

  const printingToCardId = new Map(printings.map((p) => [p.id, p.card_id]));
  const printingToSetId = new Map(printings.map((p) => [p.id, p.set_id]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const setById = new Map((sets || []).map((s) => [s.id, s]));

  const enriched = picked.map((row) => {
    const cardId = printingToCardId.get(row.printing_id);
    const card = cardId ? cardById.get(cardId) : null;
    const setId = printingToSetId.get(row.printing_id);
    const set = setId ? setById.get(setId) : null;
    return {
      ...row,
      card_name: card?.name ?? null,
      card_image_large: card?.image_large ?? null,
      set_name: set?.name ?? null,
      set_logo_url: set?.logo_url ?? null,
    };
  });

  return { listings: enriched };
}

/**
 * Pick up to `limit` rows from one printing's listings.
 * Pass 1: one cheapest-priced row per unique seller, until limit or sellers exhausted.
 * Pass 2: fill remaining slots from unpicked rows, sorted price ASC.
 */
function pickVariety(rows, limit) {
  if (rows.length <= limit) return rows;

  // Group by seller
  const bySeller = new Map();
  for (const row of rows) {
    const key = row.seller_username || "_unknown";
    if (!bySeller.has(key)) bySeller.set(key, []);
    bySeller.get(key).push(row);
  }

  // Pass 1: cheapest per unique seller
  const picked = [];
  for (const [, sellerRows] of bySeller) {
    if (picked.length >= limit) break;
    const cheapest = sellerRows.reduce((a, b) =>
      Number(a.price_amount) < Number(b.price_amount) ? a : b
    );
    picked.push(cheapest);
  }

  // Pass 2: fill remaining slots from unpicked rows, cheapest first
  if (picked.length < limit) {
    const pickedSet = new Set(picked);
    const remaining = rows
      .filter((r) => !pickedSet.has(r))
      .sort((a, b) => Number(a.price_amount) - Number(b.price_amount));
    while (picked.length < limit && remaining.length > 0) {
      picked.push(remaining.shift());
    }
  }

  return picked;
}
