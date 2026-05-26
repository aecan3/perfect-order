CREATE OR REPLACE FUNCTION get_inbox_threads(viewer uuid)
RETURNS TABLE(
  peer_id            uuid,
  latest_message_id  uuid,
  latest_body        text,
  latest_sender_id   uuid,
  latest_message_type text,
  latest_metadata    jsonb,
  latest_created_at  timestamptz,
  unread_count       int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF viewer != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (
      LEAST(sender_id, recipient_id),
      GREATEST(sender_id, recipient_id)
    )
      id,
      body,
      sender_id,
      recipient_id,
      message_type,
      metadata,
      created_at,
      CASE
        WHEN sender_id = viewer THEN recipient_id
        ELSE sender_id
      END AS peer_id
    FROM messages
    WHERE sender_id = viewer OR recipient_id = viewer
    ORDER BY
      LEAST(sender_id, recipient_id),
      GREATEST(sender_id, recipient_id),
      created_at DESC
  ),
  unread AS (
    SELECT
      sender_id AS peer_id,
      COUNT(*)::int AS cnt
    FROM messages
    WHERE recipient_id = viewer AND read = false
    GROUP BY sender_id
  )
  SELECT
    l.peer_id,
    l.id              AS latest_message_id,
    l.body            AS latest_body,
    l.sender_id       AS latest_sender_id,
    l.message_type    AS latest_message_type,
    l.metadata        AS latest_metadata,
    l.created_at      AS latest_created_at,
    COALESCE(u.cnt, 0) AS unread_count
  FROM latest l
  LEFT JOIN unread u ON u.peer_id = l.peer_id
  ORDER BY l.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_inbox_threads(uuid) TO authenticated;
