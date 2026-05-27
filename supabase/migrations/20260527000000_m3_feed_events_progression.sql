-- M3: Set-progression Feed events with debounce and settle
-- Locked 27 May 2026, session 13
-- See HANDOVER.md §19 Milestone 3 for design rationale

-- 1. Drop the old user_sets INSERT trigger for set_started.
--    set_started now fires via /api/feed/record-milestone at 10%.
DROP TRIGGER IF EXISTS trg_feed_set_started ON user_sets;
DROP FUNCTION IF EXISTS feed_on_set_started();

-- 2. Wipe existing dev test rows for set_started.
--    7 rows confirmed in PART 0 audit. Pre-beta, safe to clean.
DELETE FROM feed_events WHERE event_type = 'set_started';

-- 3. Create set_completed_pending table.
--    Holds intent-to-broadcast for set_completed events during the
--    5-min settle window. On crossing 100%, a row is inserted. If
--    user drops below 100% before settle, the row is deleted (next
--    tick handles it). Cron flushes rows older than 5 min where
--    user is still at 100%.
CREATE TABLE IF NOT EXISTS set_completed_pending (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id text NOT NULL,
  crossed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

CREATE INDEX IF NOT EXISTS idx_set_completed_pending_crossed_at
  ON set_completed_pending (crossed_at);

ALTER TABLE set_completed_pending ENABLE ROW LEVEL SECURITY;
-- No policies = no access for authenticated/anon. Service role bypasses RLS.
