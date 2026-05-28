-- avatar_url now exists on profiles (added 20260528000000); return the
-- real column instead of the NULL::text placeholder from M3 PART 4.
CREATE OR REPLACE FUNCTION get_feed_events(viewer uuid)
RETURNS TABLE (
  id uuid,
  event_type text,
  related_set_id text,
  metadata jsonb,
  created_at timestamptz,
  actor_id uuid,
  actor_handle text,
  actor_avatar_url text,
  set_name text,
  set_logo_url text,
  like_count bigint,
  liked_by_me boolean,
  comment_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '30 days';
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.event_type,
    fe.related_set_id,
    fe.metadata,
    fe.created_at,
    p.id AS actor_id,
    p.handle AS actor_handle,
    p.avatar_url AS actor_avatar_url,
    s.name AS set_name,
    s.logo_url AS set_logo_url,
    COALESCE((SELECT count(*) FROM feed_event_likes l WHERE l.event_id = fe.id), 0) AS like_count,
    EXISTS (SELECT 1 FROM feed_event_likes l WHERE l.event_id = fe.id AND l.user_id = viewer) AS liked_by_me,
    COALESCE((SELECT count(*) FROM feed_event_comments c WHERE c.event_id = fe.id AND c.deleted_at IS NULL), 0) AS comment_count
  FROM feed_events fe
  INNER JOIN profiles p ON p.id = fe.actor_user_id
  INNER JOIN sets s ON s.id = fe.related_set_id
  WHERE fe.event_type = 'set_started'
    AND fe.actor_user_id IN (
      SELECT CASE
        WHEN f.user_a = viewer THEN f.user_b
        ELSE f.user_a
      END
      FROM friendships f
      WHERE f.status = 'accepted'
        AND (f.user_a = viewer OR f.user_b = viewer)
    )
    AND fe.created_at >= cutoff
  ORDER BY fe.created_at DESC
  LIMIT 50;
END;
$$;
