-- SECURITY FIX: get_friend_favourites previously accepted viewer as a
-- client-supplied parameter, allowing any authenticated user to impersonate
-- any viewer and bypass block/friendship checks. Same class of bug as the
-- get_friend_want_lists fix in 20260606030000.

-- Drop the vulnerable two-param overload explicitly.
DROP FUNCTION IF EXISTS public.get_friend_favourites(uuid, uuid);

-- New single-param version: viewer is always auth.uid(), never client-supplied.
-- Self-access (viewer = target) bypasses friendship/block checks, matching
-- the original semantics.
CREATE OR REPLACE FUNCTION public.get_friend_favourites(target uuid)
RETURNS TABLE (printing_id text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
BEGIN
  -- Reject unauthenticated callers.
  IF viewer IS NULL THEN RETURN; END IF;

  IF viewer != target THEN
    -- Block check (both directions).
    IF EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_id = viewer AND ub.blocked_id = target)
         OR (ub.blocker_id = target AND ub.blocked_id = viewer)
    ) THEN RETURN; END IF;

    -- Friendship check.
    IF NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.user_a = viewer AND f.user_b = target)
          OR (f.user_b = viewer AND f.user_a = target))
    ) THEN RETURN; END IF;
  END IF;

  RETURN QUERY
    SELECT f.printing_id, f.created_at
    FROM favourites f
    WHERE f.user_id = target;
END;
$$;
