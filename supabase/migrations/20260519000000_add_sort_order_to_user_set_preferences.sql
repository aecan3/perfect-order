-- Allow collection_mode to be null so sort_order-only upserts work without
-- needing to know or overwrite the existing collection_mode value.
ALTER TABLE user_set_preferences
  ALTER COLUMN collection_mode DROP NOT NULL,
  ALTER COLUMN collection_mode SET DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer;

CREATE INDEX IF NOT EXISTS idx_usp_sort_order
  ON user_set_preferences (user_id, sort_order);
