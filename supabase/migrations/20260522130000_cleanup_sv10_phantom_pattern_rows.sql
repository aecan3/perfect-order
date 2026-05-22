-- =============================================================================
-- Migration: cleanup_sv10_phantom_pattern_rows
-- Date: 2026-05-22
-- =============================================================================
--
-- WHY DELETING:
--   sv10 (Destined Rivals) has zero pattern variant products. Confirmed via:
--   (1) PokeCottage set guide: "Destined Rivals includes only standard and
--       reverse holo. There are no Poké Ball and Master Ball foil patterns."
--       Source: https://pokecottage.com/sets/destined-rivals-card-list
--   (2) Empirical PPT probe: GET /api/v2/cards?setId=24269 returned 256 total
--       products with 0 "(Poke Ball Pattern)" and 0 "(Master Ball Pattern)"
--       matches across all 6 pages. Definitive — not a cataloguing gap.
--
-- HOW THEY GOT THERE:
--   The 286 phantom rows (143 pokeball_reverse_holofoil + 143
--   masterball_reverse_holofoil) were inserted via untracked direct SQL in
--   the Supabase dashboard, not by any script in the codebase. The inserter
--   anticipated sv10 would follow the sv8pt5 pattern variant model before
--   confirming with an authoritative source.
--
-- HOW TO PREVENT RECURRENCE:
--   Pattern variant rows must only be created for sets confirmed as having
--   pattern variants by BOTH an authoritative source (e.g. PokeCottage) AND
--   an empirical PPT probe (GET /api/v2/cards?setId=N, count Pattern products).
--   The canonical list of confirmed pattern-variant sets lives in
--   PPT_PATTERN_SET_IDS in app/api/refresh-prices/route.js. Do not create
--   pokeball_reverse_holofoil or masterball_reverse_holofoil printings for any
--   set not in that list.
--
-- EXPECTED DELETIONS:
--   collection_entries: 2 rows (1 user, both on card #6 pokeball + masterball)
--   printings:        286 rows (143 pokeball_reverse_holofoil + 143 masterball_reverse_holofoil)
--   Total:            288 rows
-- =============================================================================

BEGIN;

-- Step 1: Remove user collection entries pointing to phantom pattern printings.
-- These cascade from the printings delete below, but deleting explicitly first
-- makes the row count auditable before the parent rows are gone.
DELETE FROM collection_entries
WHERE printing_id IN (
  SELECT id FROM printings
  WHERE set_id = 'sv10'
    AND printing_type IN ('pokeball_reverse_holofoil', 'masterball_reverse_holofoil')
);

-- Step 2: Delete the phantom pattern printing rows themselves.
DELETE FROM printings
WHERE set_id = 'sv10'
  AND printing_type IN ('pokeball_reverse_holofoil', 'masterball_reverse_holofoil');

COMMIT;
