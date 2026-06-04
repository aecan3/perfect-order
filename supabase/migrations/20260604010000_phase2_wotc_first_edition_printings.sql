-- Phase 2: Insert first_edition non-holo rows for all 9 WOTC sets, plus
-- first_edition_holofoil rows for the 9 cards confirmed missing from the DB
-- despite existing in pokemontcg.io (neo2-1, neo2-13, neo3-66, neo4-6,
-- neo4-8, neo4-12, neo4-14, neo4-108, neo4-112).
--
-- Both statements derive rows from live unlimited/unlimited_holofoil rows
-- so the count is always current and can never go stale from Phase-0 data.
--
-- Pre-migration fresh counts (from live DB, 2026-06-04):
--   base2: 48   base3: 47   base5: 65
--   gym1:  113  gym2:  112  neo1:  92
--   neo2:  58   neo3:  50   neo4:  89   first_edition subtotal: 674
--   neo2 holo gaps: 2  neo3: 1  neo4: 6  first_edition_holofoil subtotal: 9
--   Total expected new rows: 683
--
-- ON CONFLICT (id) DO NOTHING makes this safe to re-run.
-- No collection_entries are touched. No existing rows are modified.
-- Joshua invariant: collection_entries orphan join must return 0 after this runs.

-- ── 1. first_edition non-holo rows ───────────────────────────────────────────
INSERT INTO printings (
  id, card_id, set_id, card_number,
  printing_type, printing_label, display_order,
  price_usd, collection_tier, updated_at
)
SELECT
  p.card_id || '-first_edition',
  p.card_id,
  p.set_id,
  p.card_number,
  'first_edition',
  '1st Ed.',
  3,
  NULL,
  'master',
  NOW()
FROM printings p
WHERE p.set_id IN ('base2','base3','base5','gym1','gym2','neo1','neo2','neo3','neo4')
  AND p.printing_type = 'unlimited'
ON CONFLICT (id) DO NOTHING;

-- ── 2. first_edition_holofoil gap rows (9 cards confirmed in API, missing from DB) ─
INSERT INTO printings (
  id, card_id, set_id, card_number,
  printing_type, printing_label, display_order,
  price_usd, collection_tier, updated_at
)
SELECT
  p.card_id || '-first_edition_holofoil',
  p.card_id,
  p.set_id,
  p.card_number,
  'first_edition_holofoil',
  '1st Ed. Holo',
  4,
  NULL,
  'master',
  NOW()
FROM printings p
WHERE p.set_id IN ('neo2','neo3','neo4')
  AND p.printing_type = 'unlimited_holofoil'
  AND NOT EXISTS (
    SELECT 1 FROM printings p2
    WHERE p2.card_id = p.card_id
      AND p2.printing_type = 'first_edition_holofoil'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Post-migration assertion queries ─────────────────────────────────────────
-- Run these after applying; all must match expected values.

-- 1. Per-set inserted counts (must match pre-migration predictions above):
-- SELECT set_id, COUNT(*) AS fe_rows
-- FROM printings
-- WHERE set_id IN ('base2','base3','base5','gym1','gym2','neo1','neo2','neo3','neo4')
--   AND printing_type = 'first_edition'
-- GROUP BY set_id ORDER BY set_id;
-- Expected: base2=48, base3=47, base5=65, gym1=113, gym2=112, neo1=92, neo2=58, neo3=50, neo4=89

-- SELECT set_id, card_id, printing_type
-- FROM printings
-- WHERE set_id IN ('neo2','neo3','neo4')
--   AND printing_type = 'first_edition_holofoil'
--   AND card_id IN ('neo2-1','neo2-13','neo3-66','neo4-6','neo4-8','neo4-12','neo4-14','neo4-108','neo4-112')
-- ORDER BY card_id;
-- Expected: 9 rows

-- 2. Orphan join (must return 0):
-- SELECT COUNT(*) FROM collection_entries ce
-- LEFT JOIN printings p ON p.id = ce.printing_id
-- WHERE p.id IS NULL;

-- 3. Joshua invariant — run before AND after migration:
-- SELECT set_id, COUNT(DISTINCT card_number) AS owned_cards
-- FROM collection_entries
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'raffertydall@...')  -- substitute handle lookup
--   AND set_id IN ('gym1','gym2')
--   AND checked = true
-- GROUP BY set_id;
-- Expected: gym1=38, gym2=37 (or whatever the live numbers are) — identical before and after.
