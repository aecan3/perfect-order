-- Fix: remove duplicate set_milestone row produced by the parallel-tick race condition.
-- The race: two concurrent requests both passed the idempotency SELECT before either
-- INSERT completed, causing two 90% milestone rows 18ms apart (07:42:37.689 and .707).
-- Keep the earliest; delete the later duplicate.
DELETE FROM feed_events
WHERE id = 'c5f962cb-d523-406b-82a5-cd6f970a9f07';

-- Partial unique index: one set_milestone row per (user, set, threshold).
-- Partial = only applies to set_milestone rows; does not constrain other event types.
-- The DB becomes the arbiter on concurrent inserts — first wins, second gets a 23505
-- unique violation, which the route handles gracefully as a no-op success.
CREATE UNIQUE INDEX feed_events_milestone_unique_idx
  ON feed_events (actor_user_id, related_set_id, ((metadata->>'threshold')))
  WHERE event_type = 'set_milestone';
