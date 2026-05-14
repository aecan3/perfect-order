// selectMasterPrintings — use for all user-facing queries (collection value,
// progress counts, discover feed, favourites). Excludes grand_master tier
// promos so they only appear in the dedicated GM section on the set page.
//
// selectAllPrintings — use only where both tiers must be read or written,
// currently just the price-refresh API route which prices every printing.

export function selectMasterPrintings(supabase, selectClause = "*") {
  return supabase.from("printings").select(selectClause).eq("collection_tier", "master");
}

export function selectAllPrintings(supabase, selectClause = "*") {
  return supabase.from("printings").select(selectClause);
}

// fetchMasterPrintingCounts — returns a Map<set_id, count> of master-tier
// printing counts per set via a server-side aggregate. Use this instead of
// fetching every row and counting in JS, which hits the 1000-row default limit.
export async function fetchMasterPrintingCounts(supabase) {
  const { data, error } = await supabase.rpc("master_printing_counts");
  if (error) throw error;
  return new Map((data || []).map((r) => [r.set_id, Number(r.count)]));
}
