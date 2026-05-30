CREATE TABLE pool_requests (
  printing_id    text         NOT NULL REFERENCES printings(id),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at   timestamptz  NOT NULL DEFAULT now(),
  fulfilled_at   timestamptz,
  PRIMARY KEY (printing_id, user_id)
);

CREATE INDEX pool_requests_pending_idx
  ON pool_requests (requested_at)
  WHERE fulfilled_at IS NULL;

ALTER TABLE pool_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_requests_own_read" ON pool_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pool_requests_own_insert" ON pool_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
