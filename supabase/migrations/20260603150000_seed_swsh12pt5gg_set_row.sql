-- Insert Crown Zenith Galerian Gallery set row.
-- Uses code='CRZGG' instead of 'CRZ' to avoid the unique constraint collision
-- with swsh12pt5 (Crown Zenith), which shares the same ptcgoCode in the API.
-- This is the root cause of swsh12pt5gg's disappearance: a full seed:sets run
-- upserts on id but fails on the code unique constraint, silently dropping the set.
INSERT INTO sets (id, code, name, series, total, total_with_secrets, release_date, logo_url, symbol_url)
VALUES (
  'swsh12pt5gg',
  'CRZGG',
  'Crown Zenith Galerian Gallery',
  'Sword & Shield',
  70,
  70,
  '2023-01-20',
  'https://images.pokemontcg.io/swsh12pt5gg/logo.png',
  'https://images.pokemontcg.io/swsh12pt5gg/symbol.png'
)
ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  series       = EXCLUDED.series,
  total        = EXCLUDED.total,
  total_with_secrets = EXCLUDED.total_with_secrets,
  release_date = EXCLUDED.release_date,
  logo_url     = EXCLUDED.logo_url,
  symbol_url   = EXCLUDED.symbol_url;
