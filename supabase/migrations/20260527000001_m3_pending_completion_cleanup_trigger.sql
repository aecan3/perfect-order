-- M3 cleanup trigger: delete set_completed_pending rows when user
-- drops below 100% (untick or delete).
-- Asymmetric counterpart to the route-side INSERT in
-- /api/feed/record-milestone. Route handles tick-on (positive direction);
-- this trigger handles untick and delete (negative direction).
--
-- collection_entries.set_id used directly — no printings lookup needed.

CREATE OR REPLACE FUNCTION delete_pending_on_collection_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.checked = true AND NEW.checked = false THEN
    DELETE FROM set_completed_pending
    WHERE user_id = NEW.user_id AND set_id = NEW.set_id;
  ELSIF TG_OP = 'DELETE' AND OLD.checked = true THEN
    DELETE FROM set_completed_pending
    WHERE user_id = OLD.user_id AND set_id = OLD.set_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_delete_pending_on_collection_change
  AFTER UPDATE OR DELETE ON collection_entries
  FOR EACH ROW
  EXECUTE FUNCTION delete_pending_on_collection_change();
