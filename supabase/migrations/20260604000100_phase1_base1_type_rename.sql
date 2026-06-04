-- Phase 1: Rename base1 printing types to match the unlimited-era convention
-- used by all other WOTC sets (base2, base3, gym1, neo*, etc.).
-- IDs (base1-X-normal, base1-X-holofoil) are intentionally frozen;
-- the ID suffix diverges from the new type name — cosmetic only.
-- Pricing continues to work: refresh-prices matches rows by ID, not printing_type.
-- Joshua invariant: no collection_entries rows are added, removed, or re-pointed.
UPDATE printings
SET printing_type = 'unlimited',
    printing_label = 'Unlimited'
WHERE set_id = 'base1' AND printing_type = 'normal';

UPDATE printings
SET printing_type = 'unlimited_holofoil',
    printing_label = 'Unlimited Holo'
WHERE set_id = 'base1' AND printing_type = 'holofoil';
