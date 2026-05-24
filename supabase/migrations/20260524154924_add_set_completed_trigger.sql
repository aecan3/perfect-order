-- Trigger: insert a feed_events row when a user completes a set.
-- Fires on INSERT only — upsert re-assertions take the UPDATE path and do not re-fire.
-- Runs as SECURITY DEFINER to bypass RLS on feed_events (INSERT is service-role-only).

CREATE OR REPLACE FUNCTION feed_on_set_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO feed_events (actor_user_id, event_type, related_set_id)
  VALUES (NEW.user_id, 'set_completed', NEW.set_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feed_set_completed
  AFTER INSERT ON master_completions
  FOR EACH ROW
  EXECUTE FUNCTION feed_on_set_completed();
