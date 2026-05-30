-- Function: notify feed event owner of new comment
CREATE OR REPLACE FUNCTION notify_feed_event_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_owner_id UUID;
  commenter_name TEXT;
  commenter_handle TEXT;
BEGIN
  SELECT actor_user_id INTO event_owner_id
  FROM feed_events
  WHERE id = NEW.event_id;

  IF event_owner_id IS NULL OR event_owner_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(display_name, '@' || handle, 'Someone'),
    handle
  INTO commenter_name, commenter_handle
  FROM profiles
  WHERE id = NEW.author_id;

  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (
    event_owner_id,
    'feed_comment',
    'New comment on your post',
    commenter_name || ' commented on your post.',
    '/feed#event-' || NEW.event_id::text,
    jsonb_build_object('event_id', NEW.event_id, 'author_id', NEW.author_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_feed_event_comment ON feed_event_comments;
CREATE TRIGGER trg_notify_feed_event_comment
AFTER INSERT ON feed_event_comments
FOR EACH ROW
EXECUTE FUNCTION notify_feed_event_comment();

-- Function: notify feed event owner of new like, with 7-day unread stacking
CREATE OR REPLACE FUNCTION notify_feed_event_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_owner_id UUID;
  event_set_name TEXT;
  liker_name TEXT;
  existing_notif RECORD;
  existing_likers JSONB;
  new_likers JSONB;
  liker_count INT;
  new_body TEXT;
  new_title TEXT;
BEGIN
  SELECT
    fe.actor_user_id,
    s.name
  INTO event_owner_id, event_set_name
  FROM feed_events fe
  LEFT JOIN sets s ON s.id = fe.related_set_id
  WHERE fe.id = NEW.event_id;

  IF event_owner_id IS NULL OR event_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, '@' || handle, 'Someone')
  INTO liker_name
  FROM profiles
  WHERE id = NEW.user_id;

  SELECT * INTO existing_notif
  FROM notifications
  WHERE user_id = event_owner_id
    AND type = 'feed_like'
    AND read = false
    AND (metadata->>'event_id')::uuid = NEW.event_id
    AND created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_notif.id IS NULL THEN
    new_likers := jsonb_build_array(jsonb_build_object('id', NEW.user_id, 'name', liker_name));
    new_body := liker_name || ' liked your post' ||
                CASE WHEN event_set_name IS NOT NULL
                     THEN ' about ' || event_set_name
                     ELSE ''
                END || '.';

    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    VALUES (
      event_owner_id,
      'feed_like',
      'New like on your post',
      new_body,
      '/feed#event-' || NEW.event_id::text,
      jsonb_build_object(
        'event_id', NEW.event_id,
        'likers', new_likers,
        'liker_count', 1
      )
    );
  ELSE
    existing_likers := COALESCE(existing_notif.metadata->'likers', '[]'::jsonb);

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(existing_likers) AS le
      WHERE (le->>'id')::uuid = NEW.user_id
    ) THEN
      RETURN NEW;
    END IF;

    new_likers := jsonb_build_array(jsonb_build_object('id', NEW.user_id, 'name', liker_name)) || existing_likers;
    liker_count := jsonb_array_length(new_likers);

    IF liker_count = 1 THEN
      new_body := (new_likers->0->>'name') || ' liked your post' ||
                  CASE WHEN event_set_name IS NOT NULL THEN ' about ' || event_set_name ELSE '' END || '.';
    ELSIF liker_count = 2 THEN
      new_body := (new_likers->0->>'name') || ' and ' || (new_likers->1->>'name') || ' liked your post' ||
                  CASE WHEN event_set_name IS NOT NULL THEN ' about ' || event_set_name ELSE '' END || '.';
    ELSE
      new_body := (new_likers->0->>'name') || ', ' || (new_likers->1->>'name') || ' and ' || (liker_count - 2)::text ||
                  CASE WHEN (liker_count - 2) = 1 THEN ' other' ELSE ' others' END ||
                  ' liked your post' ||
                  CASE WHEN event_set_name IS NOT NULL THEN ' about ' || event_set_name ELSE '' END || '.';
    END IF;

    new_title := CASE WHEN liker_count = 1 THEN 'New like on your post' ELSE 'New likes on your post' END;

    UPDATE notifications
    SET title = new_title,
        body = new_body,
        metadata = jsonb_set(
          jsonb_set(existing_notif.metadata, '{likers}', new_likers),
          '{liker_count}', to_jsonb(liker_count)
        ),
        created_at = NOW()
    WHERE id = existing_notif.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_feed_event_like ON feed_event_likes;
CREATE TRIGGER trg_notify_feed_event_like
AFTER INSERT ON feed_event_likes
FOR EACH ROW
EXECUTE FUNCTION notify_feed_event_like();
