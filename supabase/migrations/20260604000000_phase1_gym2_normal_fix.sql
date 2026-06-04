-- Phase 1: gym2-113 stray `normal` row correction.
-- Card "Cinnabar City Gym" (#113) was seeded with printing_type='normal' but
-- all other gym2 non-holos use 'unlimited'. Correct the type in-place.
-- ID gym2-113-normal is intentionally frozen (pricing matches by ID).
UPDATE printings
SET printing_type = 'unlimited',
    printing_label = 'Unlimited'
WHERE id = 'gym2-113-normal';
