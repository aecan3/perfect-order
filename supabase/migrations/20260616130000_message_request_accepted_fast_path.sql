-- Message Requests — PART 2a: tighten the friendship fast-path to ACCEPTED only.
--
-- In PART 1, create_message_request treated ANY friendship row (pending OR accepted)
-- as "already connected" and returned 'friends' (normal-message fast-path). That is
-- wrong: a PENDING friendship is not a connection. A pending pair must route through
-- the request gate exactly like a stranger — only an ACCEPTED friendship bypasses it.
--
-- Body-only CREATE OR REPLACE (no DROP; signature/return unchanged). Only the
-- friendship EXISTS check gains `AND status = 'accepted'`; every other line is
-- identical to 20260616120000.
CREATE OR REPLACE FUNCTION public.create_message_request(
  p_recipient_id  uuid,
  p_first_message text,
  p_payload       jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor         uuid := auth.uid();
  v_inserted      boolean;
  v_sender_handle text;
  v_sender_name   text;
BEGIN
  -- Actor derived internally, never a param (house security rule).
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null: authentication required';
  END IF;

  IF v_actor = p_recipient_id THEN
    RAISE EXCEPTION 'cannot send a message request to yourself';
  END IF;

  -- Block check (is_blocked is symmetric). No-op WITHOUT revealing the block.
  IF is_blocked(v_actor, p_recipient_id) THEN
    RETURN 'blocked';
  END IF;

  -- Friendship fast-path requires an ACCEPTED friendship (symmetric). A PENDING
  -- friendship is NOT a connection — it routes through the request gate like a
  -- stranger. Only accepted friends bypass the gate; the PART 2 caller then does
  -- the normal messages insert.
  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE ((user_a = v_actor        AND user_b = p_recipient_id)
        OR (user_a = p_recipient_id AND user_b = v_actor))
      AND status = 'accepted'
  ) THEN
    RETURN 'friends';
  END IF;

  -- Not accepted-friends → upsert the held request. A re-send REPLACES the held content (D1).
  INSERT INTO message_requests (sender_id, recipient_id, first_message, payload, status)
  VALUES (v_actor, p_recipient_id, p_first_message, p_payload, 'pending')
  ON CONFLICT (sender_id, recipient_id) DO UPDATE
    SET first_message = EXCLUDED.first_message,
        payload       = EXCLUDED.payload,
        created_at     = now()
  RETURNING (xmax = 0) INTO v_inserted;   -- xmax = 0 ⇒ a fresh INSERT, not the conflict UPDATE

  -- Notify ONLY on a genuinely new request. Re-sends do NOT re-notify (D1).
  IF v_inserted THEN
    SELECT handle, COALESCE(display_name, '@' || handle, 'Someone')
      INTO v_sender_handle, v_sender_name
      FROM profiles
     WHERE id = v_actor;

    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    VALUES (
      p_recipient_id,
      'message_request',
      'Message request',
      COALESCE(v_sender_name, 'Someone') || ' wants to send you a message.',
      '/messages?tab=requests',
      jsonb_build_object('sender_id', v_actor)
    );
    RETURN 'created';
  END IF;

  RETURN 'updated';
END;
$$;
