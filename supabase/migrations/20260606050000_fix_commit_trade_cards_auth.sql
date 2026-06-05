-- SECURITY FIX: commit_trade_cards previously accepted p_user_id as a
-- client-supplied parameter with no enforcement that it equals the calling
-- user. Any authenticated user could call supabase.rpc("commit_trade_cards",
-- { p_user_id: "victim-uuid", ... }) and write cards into another user's
-- collection.
--
-- Fix: strict identity guard at the top. IS DISTINCT FROM handles NULLs:
-- raises when auth.uid() is NULL (unauthenticated) OR when it doesn't match
-- p_user_id.
--
-- Call-path consequence: the only legitimate caller
-- (app/api/trade-binder/commit/route.js) was using the service-role client,
-- which makes auth.uid() NULL inside the function. That call site has been
-- updated to use the authenticated user's session client (anonClient) so that
-- auth.uid() equals user.id when the function runs. Service-role client is
-- no longer used for this RPC.

CREATE OR REPLACE FUNCTION public.commit_trade_cards(
  p_user_id uuid,
  p_cards   jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Caller must be the authenticated user identified by p_user_id.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.collection_entries
    (user_id, set_id, card_number, printing_id, checked, duplicate_count, trade_flagged)
  SELECT
    p_user_id,
    (elem->>'set_id')::text,
    (elem->>'card_number')::integer,
    (elem->>'printing_id')::text,
    true,
    0,
    true
  FROM jsonb_array_elements(p_cards) AS elem
  ON CONFLICT (user_id, set_id, card_number, printing_id)
  DO UPDATE SET trade_flagged = true;
END;
$$;
