-- Trigger: insert a feed_events row when a user favourites a card.
-- Looks up related_card_id and related_set_id from printings.
-- If the printing row is missing, still writes the event with NULLs rather than failing.
-- Runs as SECURITY DEFINER to bypass RLS on feed_events (INSERT is service-role-only).

CREATE OR REPLACE FUNCTION feed_on_card_favourited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id text;
  v_set_id  text;
BEGIN
  SELECT card_id, set_id
    INTO v_card_id, v_set_id
    FROM printings
   WHERE id = NEW.printing_id;

  INSERT INTO feed_events (actor_user_id, event_type, related_card_id, related_set_id)
  VALUES (NEW.user_id, 'card_favourited', v_card_id, v_set_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feed_card_favourited
  AFTER INSERT ON favourites
  FOR EACH ROW
  EXECUTE FUNCTION feed_on_card_favourited();
