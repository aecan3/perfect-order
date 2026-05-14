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
