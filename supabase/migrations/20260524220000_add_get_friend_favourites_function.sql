CREATE OR REPLACE FUNCTION get_friend_favourites(viewer uuid, target uuid)
RETURNS TABLE (printing_id text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow self-access OR verify accepted friendship
  IF viewer != target THEN
    -- Block check (both directions)
    IF EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_id = viewer AND ub.blocked_id = target)
         OR (ub.blocker_id = target AND ub.blocked_id = viewer)
    ) THEN
      RETURN;
    END IF;

    -- Friendship check
    IF NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.user_a = viewer AND f.user_b = target)
          OR (f.user_b = viewer AND f.user_a = target))
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- Return target's favourites
  RETURN QUERY
    SELECT f.printing_id, f.created_at
    FROM favourites f
    WHERE f.user_id = target;
END;
$$;
