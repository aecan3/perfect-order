-- notify_new_message: previously skipped ALL trade_proposal messages (to avoid
-- double-notifying the formal /api/trade/propose flow, which inserts its own
-- 'trade_proposal' notification). That also silenced trade_proposal messages sent
-- by the trade-request modal (/sets) and the Discover/duplicates ?cards composer —
-- which carry NO metadata.trade_id and have no other notification path.
--
-- Fix: discriminate on metadata.trade_id. Formal trades (trade_id present) stay
-- skipped (the API notifies). A trade_proposal WITHOUT a trade_id now fires the
-- standard new_message notification. trade_verification_photo stays skipped.
--
-- Body-only change → CREATE OR REPLACE (no DROP needed; signature/return unchanged,
-- so the trg_notify_new_message AFTER INSERT trigger stays attached).
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_handle text;
  sender_name   text;
BEGIN
  -- trade_verification_photo is part of the formal trade flow — never a new_message push.
  IF NEW.message_type = 'trade_verification_photo' THEN
    RETURN NEW;
  END IF;

  -- Formal trades carry metadata.trade_id and are notified by /api/trade/propose
  -- (type 'trade_proposal') — skip to avoid a double. A trade_proposal WITHOUT a
  -- trade_id (modal / Discover card-interest) has no other notification → notify it.
  IF NEW.message_type = 'trade_proposal' AND NEW.metadata->>'trade_id' IS NOT NULL THEN
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
