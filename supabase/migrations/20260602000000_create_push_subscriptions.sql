-- Web Push subscriptions table.
-- One row per (user, browser endpoint) pair. Re-subscribing the same endpoint
-- is idempotent via the UNIQUE constraint + upsert on conflict in the API route.
CREATE TABLE push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own subscriptions.
CREATE POLICY "push_subscriptions_own"
  ON push_subscriptions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
