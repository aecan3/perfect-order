-- Trigger: insert a feed_events row when a user adds a set to their collection.
-- Runs as SECURITY DEFINER to bypass RLS on feed_events (INSERT is service-role-only).

CREATE OR REPLACE FUNCTION feed_on_set_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO feed_events (actor_user_id, event_type, related_set_id)
  VALUES (NEW.user_id, 'set_started', NEW.set_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feed_set_started
  AFTER INSERT ON user_sets
  FOR EACH ROW
  EXECUTE FUNCTION feed_on_set_started();
