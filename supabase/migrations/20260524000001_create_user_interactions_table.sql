-- user_interactions: records user interaction events for feed personalisation and activity tracking.
-- INSERT is service-role-only; rows are written by Postgres trigger functions (security definer).
-- SELECT is scoped to the actor's own interactions only.

CREATE TABLE user_interactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type      text        NOT NULL CHECK (target_type IN ('profile', 'set', 'card', 'message_thread')),
  target_id        text        NOT NULL,
  interaction_type text        NOT NULL CHECK (interaction_type IN ('view', 'message_sent', 'profile_open')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Query pattern: fetch interactions for a given user, ordered by recency
CREATE INDEX user_interactions_user_created_idx
  ON user_interactions (user_id, created_at DESC);

-- RLS: enable and lock down
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- INSERT: service role only — no authenticated user may write directly
-- (No INSERT policy created; absence of policy means authenticated role is denied)

-- SELECT: user sees only their own interactions
CREATE POLICY user_interactions_select ON user_interactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
