-- Insert 15 missing SH (Shiny) and RT (Rotom form) variant cards across 4 Platinum-era sets.
--
-- These cards were absent from the pokemontcg.io API at the time those sets were originally
-- seeded, and were added to the API later. They were identified in the 2026-06-03 diagnostic.
--
-- Why INSERT instead of re-running seed:sets:
-- seed:sets does DELETE WHERE set_id=X before reinserting — which CASCADE-deletes printings,
-- which CASCADE-deletes collection_entries. Even though these sets currently have zero
-- collection_entries, the cascade path violates the hard guardrail. Direct INSERT is safe.
--
-- Number assignment: seed-sets.mjs renumbers non-numeric-suffix cards (SH4, RT1, etc.)
-- to max+1, max+2... to avoid (set_id, number) unique constraint conflicts with base cards.
-- We replicate that logic here: each card gets the next available integer after the current max.
--
-- total_with_secrets updated to match the API's set.total for each affected set.

-- ── dp7 (Stormfront) — current max: 103, adding SH1–SH3 ──────────────────────────────────
INSERT INTO cards (id, set_id, number, name, rarity, supertype, subtypes, image_small, image_large, price_usd)
VALUES
  ('dp7-SH1', 'dp7', 104, 'Drifloon',  'Rare', 'Pokemon', ARRAY['Basic'], 'https://images.pokemontcg.io/dp7/SH1.png',  'https://images.pokemontcg.io/dp7/SH1_hires.png',  67.45),
  ('dp7-SH2', 'dp7', 105, 'Duskull',   'Rare', 'Pokemon', ARRAY['Basic'], 'https://images.pokemontcg.io/dp7/SH2.png',  'https://images.pokemontcg.io/dp7/SH2_hires.png', 129.06),
  ('dp7-SH3', 'dp7', 106, 'Voltorb',   'Rare', 'Pokemon', ARRAY['Basic'], 'https://images.pokemontcg.io/dp7/SH3.png',  'https://images.pokemontcg.io/dp7/SH3_hires.png',  35.98)
ON CONFLICT (id) DO NOTHING;

UPDATE sets SET total_with_secrets = 106 WHERE id = 'dp7';

-- ── pl1 (Platinum) — current max: 130, adding SH4–SH6 ───────────────────────────────────
INSERT INTO cards (id, set_id, number, name, rarity, supertype, subtypes, image_small, image_large, price_usd)
VALUES
  ('pl1-SH4', 'pl1', 131, 'Lotad',  'Rare', 'Pokemon', ARRAY['Basic'], 'https://images.pokemontcg.io/pl1/SH4.png', 'https://images.pokemontcg.io/pl1/SH4_hires.png',  63.96),
  ('pl1-SH5', 'pl1', 132, 'Swablu', 'Rare', 'Pokemon', ARRAY['Basic'], 'https://images.pokemontcg.io/pl1/SH5.png', 'https://images.pokemontcg.io/pl1/SH5_hires.png',  77.06),
  ('pl1-SH6', 'pl1', 133, 'Vulpix', 'Rare', 'Pokemon', ARRAY['Basic'], 'https://images.pokemontcg.io/pl1/SH6.png', 'https://images.pokemontcg.io/pl1/SH6_hires.png', 157.42)
ON CONFLICT (id) DO NOTHING;

UPDATE sets SET total_with_secrets = 133 WHERE id = 'pl1';

-- ── pl2 (Rising Rivals) — current max: 114, adding RT1–RT6 ──────────────────────────────
INSERT INTO cards (id, set_id, number, name, rarity, supertype, subtypes, image_small, image_large, price_usd)
VALUES
  ('pl2-RT1', 'pl2', 115, 'Fan Rotom',        'Rare', 'Pokemon',  ARRAY['Basic'],     'https://images.pokemontcg.io/pl2/RT1.png', 'https://images.pokemontcg.io/pl2/RT1_hires.png', 31.51),
  ('pl2-RT2', 'pl2', 116, 'Frost Rotom',      'Rare', 'Pokemon',  ARRAY['Basic'],     'https://images.pokemontcg.io/pl2/RT2.png', 'https://images.pokemontcg.io/pl2/RT2_hires.png', 43.57),
  ('pl2-RT3', 'pl2', 117, 'Heat Rotom',       'Rare', 'Pokemon',  ARRAY['Basic'],     'https://images.pokemontcg.io/pl2/RT3.png', 'https://images.pokemontcg.io/pl2/RT3_hires.png', 56.97),
  ('pl2-RT4', 'pl2', 118, 'Mow Rotom',        'Rare', 'Pokemon',  ARRAY['Basic'],     'https://images.pokemontcg.io/pl2/RT4.png', 'https://images.pokemontcg.io/pl2/RT4_hires.png', 39.99),
  ('pl2-RT5', 'pl2', 119, 'Wash Rotom',       'Rare', 'Pokemon',  ARRAY['Basic'],     'https://images.pokemontcg.io/pl2/RT5.png', 'https://images.pokemontcg.io/pl2/RT5_hires.png', 50.26),
  ('pl2-RT6', 'pl2', 120, 'Charon''s Choice', 'Rare', 'Trainer', ARRAY['Supporter'], 'https://images.pokemontcg.io/pl2/RT6.png', 'https://images.pokemontcg.io/pl2/RT6_hires.png', 10.49)
ON CONFLICT (id) DO NOTHING;

UPDATE sets SET total_with_secrets = 120 WHERE id = 'pl2';

-- ── pl3 (Supreme Victors) — current max: 150, adding SH7–SH9 ────────────────────────────
INSERT INTO cards (id, set_id, number, name, rarity, supertype, subtypes, image_small, image_large, price_usd)
VALUES
  ('pl3-SH7', 'pl3', 151, 'Milotic',   'Rare', 'Pokemon', ARRAY['Stage 1'], 'https://images.pokemontcg.io/pl3/SH7.png', 'https://images.pokemontcg.io/pl3/SH7_hires.png', 241.89),
  ('pl3-SH8', 'pl3', 152, 'Relicanth', 'Rare', 'Pokemon', ARRAY['Basic'],   'https://images.pokemontcg.io/pl3/SH8.png', 'https://images.pokemontcg.io/pl3/SH8_hires.png',  99.98),
  ('pl3-SH9', 'pl3', 153, 'Yanma',     'Rare', 'Pokemon', ARRAY['Basic'],   'https://images.pokemontcg.io/pl3/SH9.png', 'https://images.pokemontcg.io/pl3/SH9_hires.png',  64.52)
ON CONFLICT (id) DO NOTHING;

UPDATE sets SET total_with_secrets = 153 WHERE id = 'pl3';
