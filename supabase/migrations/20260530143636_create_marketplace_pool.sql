CREATE TABLE marketplace_pool (
  printing_id        text         PRIMARY KEY REFERENCES printings(id),
  added_at           timestamptz  NOT NULL DEFAULT now(),
  last_refreshed_at  timestamptz,
  next_due_at        timestamptz  NOT NULL DEFAULT now(),
  enabled            boolean      NOT NULL DEFAULT true
);

CREATE INDEX marketplace_pool_next_due_idx
  ON marketplace_pool (next_due_at)
  WHERE enabled;

ALTER TABLE marketplace_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_pool_read" ON marketplace_pool
  FOR SELECT USING (auth.uid() IS NOT NULL);
