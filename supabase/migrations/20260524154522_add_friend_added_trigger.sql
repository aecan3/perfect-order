-- Trigger: insert two feed_events rows when a friendship transitions to accepted.
-- Fires ONLY on the pending→accepted transition (WHEN clause guards re-saves).
-- Runs as SECURITY DEFINER to bypass RLS on feed_events (INSERT is service-role-only).

CREATE OR REPLACE FUNCTION feed_on_friend_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- One event for each side of the friendship
  INSERT INTO feed_events (actor_user_id, event_type, related_user_id)
  VALUES
    (NEW.user_a, 'friend_added', NEW.user_b),
    (NEW.user_b, 'friend_added', NEW.user_a);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feed_friend_added
  AFTER UPDATE ON friendships
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status != 'accepted')
  EXECUTE FUNCTION feed_on_friend_added();
