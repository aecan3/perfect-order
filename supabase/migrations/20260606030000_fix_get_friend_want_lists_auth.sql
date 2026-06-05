-- SECURITY FIX: get_friend_want_lists previously accepted viewer as a
-- client-supplied parameter, allowing any authenticated user to impersonate
-- any viewer and bypass block/friendship checks. Replace with a single-
-- parameter version that derives the viewer from auth.uid() internally.

-- Drop the vulnerable two-param overload explicitly.
DROP FUNCTION IF EXISTS public.get_friend_want_lists(uuid, uuid);

-- New single-param version: viewer is always auth.uid(), never client-supplied.
CREATE OR REPLACE FUNCTION public.get_friend_want_lists(target uuid)
RETURNS TABLE (
  id         uuid,
  slug       text,
  title      text,
  created_at timestamptz,
  card_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
BEGIN
  -- Reject unauthenticated callers.
  IF viewer IS NULL THEN RETURN; END IF;

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

  RETURN QUERY
    SELECT wl.id, wl.slug, wl.title, wl.created_at,
           COUNT(wlc.id)::bigint AS card_count
    FROM want_lists wl
    LEFT JOIN want_list_cards wlc ON wlc.want_list_id = wl.id
    WHERE wl.user_id = target
    GROUP BY wl.id, wl.slug, wl.title, wl.created_at
    ORDER BY wl.created_at DESC;
END;
$$;
