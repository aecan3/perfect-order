-- Base Set (base1): add first_edition, first_edition_holofoil, shadowless, shadowless_holofoil printings.
-- 204 new rows derived from existing unlimited/unlimited_holofoil rows.
-- ON CONFLICT DO NOTHING makes this safe to re-run.
--
-- display_order note (v1 tradeoff): Shadowless Holo lands at 6, Unlimited Holo stays at 1 —
-- reversed vs historical rarity. A future migration can fix by renumbering unlimited_holofoil→7
-- and assigning shadowless_holofoil→5.

-- 1a. first_edition non-holo (87)
INSERT INTO printings (id, card_id, set_id, card_number, printing_type, printing_label,
                       display_order, price_usd, collection_tier, updated_at)
SELECT p.card_id || '-first_edition', p.card_id, p.set_id, p.card_number,
       'first_edition', '1st Ed.', 3, NULL, 'master', NOW()
FROM printings p
WHERE p.set_id = 'base1' AND p.printing_type = 'unlimited'
ON CONFLICT (id) DO NOTHING;

-- 1b. first_edition_holofoil (15)
INSERT INTO printings (id, card_id, set_id, card_number, printing_type, printing_label,
                       display_order, price_usd, collection_tier, updated_at)
SELECT p.card_id || '-first_edition_holofoil', p.card_id, p.set_id, p.card_number,
       'first_edition_holofoil', '1st Ed. Holo', 4, NULL, 'master', NOW()
FROM printings p
WHERE p.set_id = 'base1' AND p.printing_type = 'unlimited_holofoil'
ON CONFLICT (id) DO NOTHING;

-- 1c. shadowless non-holo (87)
INSERT INTO printings (id, card_id, set_id, card_number, printing_type, printing_label,
                       display_order, price_usd, collection_tier, updated_at)
SELECT p.card_id || '-shadowless', p.card_id, p.set_id, p.card_number,
       'shadowless', 'Shadowless', 5, NULL, 'master', NOW()
FROM printings p
WHERE p.set_id = 'base1' AND p.printing_type = 'unlimited'
ON CONFLICT (id) DO NOTHING;

-- 1d. shadowless_holofoil (15)
INSERT INTO printings (id, card_id, set_id, card_number, printing_type, printing_label,
                       display_order, price_usd, collection_tier, updated_at)
SELECT p.card_id || '-shadowless_holofoil', p.card_id, p.set_id, p.card_number,
       'shadowless_holofoil', 'Shadowless Holo', 6, NULL, 'master', NOW()
FROM printings p
WHERE p.set_id = 'base1' AND p.printing_type = 'unlimited_holofoil'
ON CONFLICT (id) DO NOTHING;
