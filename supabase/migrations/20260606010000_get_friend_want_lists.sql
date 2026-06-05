-- Returns the want lists for `target` that `viewer` is allowed to see.
-- Access: accepted friendship required; block in either direction returns nothing.
CREATE OR REPLACE FUNCTION get_friend_want_lists(viewer uuid, target uuid)
RETURNS TABLE (
  id         uuid,
  slug       text,
  title      text,
  created_at timestamptz,
  card_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Block check (both directions)
  IF EXISTS (
    SELECT 1 FROM user_blocks ub
    WHERE (ub.blocker_id = viewer AND ub.blocked_id = target)
       OR (ub.blocker_id = target AND ub.blocked_id = viewer)
  ) THEN RETURN; END IF;

  -- Friendship check
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
