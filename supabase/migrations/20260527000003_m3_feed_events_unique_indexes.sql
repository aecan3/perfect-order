-- M3 race-fix: partial unique indexes for set_started and set_completed.
-- Discovered during fut20 smoke test re-run: 5 rapid ticks fired 3
-- concurrent route calls, all of which passed the pre-fetch idempotency
-- check before any INSERT committed, all inserted, three set_started
-- rows resulted.
--
-- Same pattern as feed_events_milestone_unique_idx (session 10 fix for
-- the milestone race) — partial unique on (actor_user_id, related_set_id)
-- WHERE event_type = '<type>'. The route's 23505 error handlers for
-- set_started and the cron function's EXCEPTION WHEN unique_violation
-- for set_completed are already in place.
--
-- Note: card_favourited and friend_added do NOT need equivalent indexes.
-- They fire from Postgres triggers on favourites INSERT and friendships
-- UPDATE respectively — the source-row constraints (favourites unique
-- key, friendships unique pair) prevent duplicate trigger fires at the
-- source. Only route-based events need this guard.

CREATE UNIQUE INDEX IF NOT EXISTS feed_events_set_started_unique_idx
  ON feed_events (actor_user_id, related_set_id)
  WHERE event_type = 'set_started';

CREATE UNIQUE INDEX IF NOT EXISTS feed_events_set_completed_unique_idx
  ON feed_events (actor_user_id, related_set_id)
  WHERE event_type = 'set_completed';
