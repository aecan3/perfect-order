-- Phase 5: Add edition_mode to user_sets.
-- Controls which edition printings count toward set completion on the set page.
-- 'any'  = slot-level (first_edition + unlimited collapse to same slot) — default
-- 'all'  = every printing must be owned
-- 'first_edition' / 'unlimited' / 'shadowless' = that edition only
-- CHECK constraint is intentionally strict: future editions cost one migration.
-- ON CONFLICT safe: re-running does nothing (column already exists).

ALTER TABLE user_sets
ADD COLUMN edition_mode text NOT NULL DEFAULT 'any'
CHECK (edition_mode IN ('any','all','first_edition','unlimited','shadowless'));
