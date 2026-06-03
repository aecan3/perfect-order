CREATE OR REPLACE FUNCTION public.commit_trade_cards(
  p_user_id uuid,
  p_cards   jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
