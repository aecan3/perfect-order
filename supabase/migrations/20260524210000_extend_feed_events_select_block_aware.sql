-- Extend feed_events SELECT policy to exclude blocked users (both directions).
-- Original policy: viewer sees own events OR accepted friends' events.
-- New policy: same condition AND actor is not in a block relationship with the viewer.
-- Result: blocked users' feed events are invisible to the blocker and vice versa,
-- regardless of whether the friendship row has been severed yet.

DROP POLICY feed_events_select ON feed_events;

CREATE POLICY feed_events_select ON feed_events
  FOR SELECT TO authenticated
  USING (
    (
      actor_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.user_a = auth.uid() AND f.user_b = feed_events.actor_user_id)
            OR (f.user_b = auth.uid() AND f.user_a = feed_events.actor_user_id))
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = feed_events.actor_user_id)
         OR (ub.blocker_id = feed_events.actor_user_id AND ub.blocked_id = auth.uid())
    )
  );
