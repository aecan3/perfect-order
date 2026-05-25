CREATE TABLE user_blocks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  reason        text        NULL,
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX user_blocks_blocker_idx ON user_blocks (blocker_id);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Blocker sees only their own block records; blocked user cannot see they were blocked (silent block)
CREATE POLICY user_blocks_select ON user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

-- Users can only insert blocks where they are the blocker
CREATE POLICY user_blocks_insert ON user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

-- Users can only delete (unblock) their own block records
CREATE POLICY user_blocks_delete ON user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- SECURITY DEFINER function: opaque block check that bypasses RLS internally.
-- Returns true if either user has blocked the other; reveals no row data.
-- Used by API routes and triggers to enforce block visibility without exposing
-- which direction the block came from.
CREATE OR REPLACE FUNCTION is_blocked(viewer uuid, target uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = viewer AND blocked_id = target)
       OR (blocker_id = target AND blocked_id = viewer)
  );
$$;
