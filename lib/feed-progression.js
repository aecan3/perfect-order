// COMPUTE OWNERSHIP PERCENTAGE
//
// This helper is the JS-side implementation of ownership pct calculation.
// A SQL-side equivalent exists inside the flush_pending_completions()
// Postgres function (see migration *_m3_pg_cron_flush_pending_completions.sql).
//
// If you change the master-tier filter, the join shape, or the rounding
// here, you MUST also update the SQL function. Drift between the two
// will cause set_completed events to fire when they shouldn't, or fail
// to fire when they should.
//
// The JS helper is called by:
//   - app/api/feed/record-milestone/route.js (set_started, set_milestone,
//     set_completed pending-row INSERT)
//
// The SQL function is called by:
//   - pg_cron, every 5 minutes (flushes set_completed_pending rows)

import { selectMasterPrintings } from "./queries/printings";

// computeOwnershipPct — shared helper for milestone route and flush-pending-completions cron.
// Both must use identical logic so route-side INSERTs and cron-side flushes agree on pct.
// client may be anon (user-scoped) or service-role; userId must always be passed explicitly.
export async function computeOwnershipPct(client, userId, setId) {
  const { data: masterPrintings, error: printingsError } = await selectMasterPrintings(client, "id")
    .eq("set_id", setId);
  if (printingsError) throw printingsError;

  const total = (masterPrintings || []).length;
  if (total === 0) return { pct: 0, total: 0 };

  const masterPrintingIds = masterPrintings.map((p) => p.id);

  const { data: ownedEntries, error: ownedError } = await client
    .from("collection_entries")
    .select("printing_id")
    .eq("user_id", userId)
    .eq("set_id", setId)
    .eq("checked", true)
    .in("printing_id", masterPrintingIds);
  if (ownedError) throw ownedError;

  const owned = (ownedEntries || []).length;
  return { pct: Math.round((owned / total) * 100), total };
}
