-- Message Requests — Option 1 ("hold the body"). PART 1: schema + RPCs + trigger guard.
--
-- A non-friend who tries to message someone has their message HELD here (never
-- entering `messages`) until the recipient accepts. Accept creates the friendship
-- and replays the held content into the normal thread; decline drops it.
--
-- Decisions locked in PART 0:
--   D1 re-send  = REPLACE the held content (ON CONFLICT DO UPDATE); delete-on-resolve
--                 so a plain UNIQUE(sender_id, recipient_id) suffices. No re-notify.
--   D2 decline  = delete the request row; friendships untouched.
--   D3 accept   = the replayed message carries metadata._suppress_notify so
--                 notify_new_message skips the redundant ping (the 'message_request'
--                 notification already fired at create time).
--   Friendship on accept = { user_a: sender (initiator), user_b: recipient(actor) },
--                 guarding BOTH directions first (UNIQUE(user_a,user_b) is directional).
--
-- All writes flow through the SECURITY DEFINER RPCs below (actor = auth.uid()
-- INTERNALLY, never a param). The only client-facing policy is a recipient SELECT.

-- ────────────────────────────────────────────────────────────────────────────
-- Table
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.message_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_message text        NOT NULL,
  payload       jsonb,                         -- the modal's rich metadata.cards; null for plain text
  status        text        NOT NULL DEFAULT 'pending'
                            CONSTRAINT message_requests_status_check
                            CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_requests_no_self CHECK (sender_id <> recipient_id),
  CONSTRAINT message_requests_sender_recipient_key UNIQUE (sender_id, recipient_id)
);

CREATE INDEX message_requests_recipient_idx ON public.message_requests (recipient_id);

ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;

-- Minimal client surface: a recipient may read their own incoming requests.
-- There are deliberately NO client INSERT/UPDATE/DELETE policies — every write
-- goes through the SECURITY DEFINER RPCs (which run as owner and bypass RLS).
CREATE POLICY message_requests_recipient_select ON public.message_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RPC 1 — create_message_request
-- Not-friends path only. Returns: 'blocked' | 'friends' | 'created' | 'updated'.
-- ────────────────────────────────────────────────────────────────────────────
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

  -- Friendship check (symmetric, ANY status). If a row already exists in either
  -- orientation this is NOT a request case — signal the caller to fall back to a
  -- normal message insert (PART 2). The RPC owns ONLY the not-friends path.
  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE (user_a = v_actor        AND user_b = p_recipient_id)
       OR (user_a = p_recipient_id AND user_b = v_actor)
  ) THEN
    RETURN 'friends';
  END IF;

  -- Not friends → upsert the held request. A re-send REPLACES the held content (D1).
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

-- ────────────────────────────────────────────────────────────────────────────
-- RPC 2 — accept_message_request
-- Recipient-only. Atomically: friendship→accepted, replay held content, drop request.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_message_request(p_request_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor         uuid := auth.uid();
  v_sender        uuid;
  v_recipient     uuid;
  v_first_message text;
  v_payload       jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null: authentication required';
  END IF;

  SELECT sender_id, recipient_id, first_message, payload
    INTO v_sender, v_recipient, v_first_message, v_payload
    FROM message_requests
   WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message request % not found', p_request_id;
  END IF;

  -- Only the recipient may accept their own incoming request.
  IF v_recipient <> v_actor THEN
    RAISE EXCEPTION 'not authorised to accept this message request';
  END IF;

  -- (a) Friendship → accepted. Guard BOTH directions (UNIQUE(user_a,user_b) is
  -- directional): flip an existing row in either orientation; otherwise insert
  -- with the sender as initiator (user_a), per the verified convention.
  UPDATE friendships
     SET status = 'accepted'
   WHERE (user_a = v_sender AND user_b = v_actor)
      OR (user_a = v_actor  AND user_b = v_sender);
  IF NOT FOUND THEN
    INSERT INTO friendships (user_a, user_b, status)
    VALUES (v_sender, v_actor, 'accepted');
  END IF;

  -- (b) Replay the held content into the normal thread, UNREAD from the new
  -- friend. _suppress_notify makes notify_new_message skip the redundant ping
  -- (the 'message_request' notification already fired at create time — D3).
  INSERT INTO messages (sender_id, recipient_id, body, message_type, metadata, read)
  VALUES (
    v_sender,
    v_actor,
    v_first_message,
    CASE WHEN v_payload IS NOT NULL THEN 'trade_proposal' ELSE 'message' END,
    COALESCE(v_payload, '{}'::jsonb) || jsonb_build_object('_suppress_notify', true),
    false
  );

  -- (c) Resolve (delete-on-resolve).
  DELETE FROM message_requests WHERE id = p_request_id;

  RETURN 'accepted';
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC 3 — decline_message_request
-- Recipient-only. Delete the request; touch friendships NOT AT ALL (D2).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decline_message_request(p_request_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_recipient uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null: authentication required';
  END IF;

  SELECT recipient_id INTO v_recipient
    FROM message_requests
   WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message request % not found', p_request_id;
  END IF;

  IF v_recipient <> v_actor THEN
    RAISE EXCEPTION 'not authorised to decline this message request';
  END IF;

  -- Delete only. No friendship touch (D2). No notification, no block.
  DELETE FROM message_requests WHERE id = p_request_id;

  RETURN 'declined';
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger guard — notify_new_message (body-only CREATE OR REPLACE, no DROP).
-- Adds ONE skip: accept-replayed held messages carry _suppress_notify and must
-- not fire a 'new_message' ping. Every other branch is byte-identical to the
-- 20260615091623 version (must not regress that trade_proposal-without-trade_id fix).
-- ────────────────────────────────────────────────────────────────────────────
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

  -- Message-request ACCEPT replays held content carrying _suppress_notify; the
  -- meaningful 'message_request' notification already fired at request-create
  -- time. Skip to avoid a redundant ping.
  IF COALESCE((NEW.metadata->>'_suppress_notify')::boolean, false) THEN
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
