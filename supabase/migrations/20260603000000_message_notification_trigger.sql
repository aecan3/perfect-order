-- Function: notify recipient of a new message, with 5-minute per-sender suppression.
-- Skips:
--   trade_proposal        — the trade API route already inserts a notification separately;
--                           firing here too would double-notify the recipient.
--   trade_verification_photo — system message, no user push warranted.
--   sender = recipient    — self-send guard (shouldn't happen in practice).
--   burst suppression     — if a new_message notification for this sender already
--                           exists in the last 5 minutes, skip. Collapses rapid
--                           message bursts into one push per sender per 5 min.
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_handle text;
  sender_name   text;
BEGIN
  -- Skip message types handled elsewhere or not warranting a push.
  IF NEW.message_type IN ('trade_proposal', 'trade_verification_photo') THEN
    RETURN NEW;
  END IF;

  -- Self-send guard.
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  -- 5-minute per-sender suppression window.
  -- Checks prior notifications rows (not messages) — the correct signal.
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.recipient_id
      AND type = 'new_message'
      AND (metadata->>'sender_id')::uuid = NEW.sender_id
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT
    handle,
    COALESCE(display_name, '@' || handle, 'Someone')
  INTO sender_handle, sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- If sender profile is missing, skip rather than inserting a broken notification.
  IF sender_handle IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.recipient_id,
    'new_message',
    'New message',
    sender_name || ' sent you a message.',
    '/messages/' || sender_handle,
    jsonb_build_object('sender_id', NEW.sender_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
