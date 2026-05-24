-- feed_events: records meaningful user activity for the social feed.
-- INSERT is service-role-only; events are written by Postgres trigger functions
-- (security definer) that fire when source tables are mutated client-side.
-- SELECT is scoped to the actor's own events plus events from accepted friends.

CREATE TABLE feed_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type      text        NOT NULL CHECK (event_type IN (
                                'set_started', 'set_completed', 'set_milestone',
                                'card_favourited', 'friend_added'
                              )),
  related_set_id  text        NULL REFERENCES sets(id) ON DELETE CASCADE,
  related_card_id text        NULL REFERENCES cards(id) ON DELETE CASCADE,
  related_user_id uuid        NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metadata        jsonb       NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Query pattern 1: fetch feed for a given user (actor's own events, ordered by recency)
CREATE INDEX feed_events_actor_created_idx
  ON feed_events (actor_user_id, created_at DESC);

-- Query pattern 2: fetch feed across all accepted friends (ordered by recency)
CREATE INDEX feed_events_created_idx
  ON feed_events (created_at DESC);

-- RLS: enable and lock down
ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

-- INSERT: service role only — no authenticated user may write directly
-- (No INSERT policy created; absence of policy means authenticated role is denied)

-- SELECT: viewer sees their own events OR events from accepted friends
CREATE POLICY feed_events_select ON feed_events
  FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_a = auth.uid() AND f.user_b = feed_events.actor_user_id)
          OR (f.user_b = auth.uid() AND f.user_a = feed_events.actor_user_id)
        )
    )
  );
