-- Returns all user IDs in a block relationship with viewer (either direction).
-- Companion to is_blocked() for bulk filtering — lets callers build a Set of
-- blocked peer IDs in one RPC call rather than N per-pair is_blocked() calls.
-- SECURITY DEFINER bypasses the restrictive SELECT policy so both directions
-- are visible to the caller without exposing any raw row data.
CREATE OR REPLACE FUNCTION get_block_peer_ids(viewer uuid)
RETURNS TABLE (peer_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocked_id AS peer_id FROM user_blocks WHERE blocker_id = viewer
  UNION
  SELECT blocker_id AS peer_id FROM user_blocks WHERE blocked_id = viewer;
$$;
