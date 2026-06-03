-- Reassign the 70 Crown Zenith Galerian Gallery cards and their printings
-- from set_id='swsh12pt5' to set_id='swsh12pt5gg'.
--
-- Root cause: seed-sets.mjs uses set_id=<parent_set_arg> when inserting cards,
-- not the card's own set.id from the API. A full seed:sets swsh12pt5 run pulled
-- the GG subset cards via the pokemontcg.io swsh12pt5 endpoint and stored them
-- with set_id='swsh12pt5'. The swsh12pt5gg set row was later lost due to the
-- ptcgoCode 'CRZ' unique constraint collision on re-seed.
--
-- PRIMARY KEYS ARE UNCHANGED. collection_entries references printings.id (not set_id)
-- so no collection_entries rows are affected.

UPDATE cards
SET set_id = 'swsh12pt5gg'
WHERE id LIKE 'swsh12pt5gg-%'
  AND set_id = 'swsh12pt5';

UPDATE printings
SET set_id = 'swsh12pt5gg'
WHERE card_id LIKE 'swsh12pt5gg-%'
  AND set_id = 'swsh12pt5';
