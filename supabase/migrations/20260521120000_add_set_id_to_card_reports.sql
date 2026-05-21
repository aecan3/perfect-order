ALTER TABLE card_reports ADD COLUMN set_id text;

-- Index for future admin queue filtering by set.
CREATE INDEX card_reports_set_id_idx ON card_reports(set_id);

-- No FK to sets.id — reports are write-mostly debugging data and the cost
-- of a referential check on every insert outweighs the integrity benefit.
-- A typo'd set_id will be visible in the notification email.
COMMENT ON COLUMN card_reports.set_id IS
  'The set the user was viewing when they tapped the flag FAB. Captured
   silently from the URL context. Nullable: existing rows pre-date this
   column and are not backfilled; future mounts on non-set surfaces may
   also leave this null.';
