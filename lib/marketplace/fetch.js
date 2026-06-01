import { getServiceClient } from "@/lib/supabase/service";

/**
 * Return fresh cached listings for a set of printings, and identify which
 * printings have no cached row or only stale rows.
 *
 * @param {string[]} printingIds
 * @param {{ marketplaceId?: string, maxAgeMinutes?: number }} options
 * @returns {{ fresh: object[], stalePrintingIds: string[] }}
 */
export async function getFreshListingsForPrintings(printingIds, {
  marketplaceId = "EBAY_AU",
  maxAgeMinutes = 480,
} = {}) {
  if (!printingIds.length) return { fresh: [], stalePrintingIds: [] };

  const supabase = getServiceClient();

  const { data: rows, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .in("printing_id", printingIds)
    .eq("marketplace_id", marketplaceId)
    .gte("fetched_at", new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString());

  if (error) throw new Error(`getFreshListingsForPrintings: query failed — ${error.message}`);

  const fresh = rows || [];
  const freshPrintingIds = new Set(fresh.map((r) => r.printing_id));
  const stalePrintingIds = printingIds.filter((id) => !freshPrintingIds.has(id));

  return { fresh, stalePrintingIds };
}
