-- Fix commit_trade_cards to upsert a hidden user_sets row for each card's set.
-- hidden_at = NOW() keeps the set out of MY SETS home-page display while
-- still satisfying the user_sets JOIN in get_cards_count (CARDS counter).
--
-- Backfill: insert hidden user_sets rows for the 2 existing flagged-only
-- entries (alex: base1-15, base1-63) that have no user_sets row.
-- Exposure query count before backfill: 2 rows.

CREATE OR REPLACE FUNCTION public.commit_trade_cards(
  p_user_id uuid,
  p_cards   jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Upsert hidden user_sets rows so these cards count toward the CARDS stat.
  INSERT INTO public.user_sets (user_id, set_id, hidden_at)
  SELECT DISTINCT p_user_id, (elem->>'set_id')::text, NOW()
  FROM jsonb_array_elements(p_cards) AS elem
  ON CONFLICT (user_id, set_id) DO NOTHING;

  -- Upsert collection entries.
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

-- Backfill: create hidden user_sets rows for existing flagged-only entries
-- in sets the user has no user_sets row for.
INSERT INTO public.user_sets (user_id, set_id, hidden_at)
SELECT DISTINCT ce.user_id, ce.set_id, NOW()
FROM collection_entries ce
LEFT JOIN user_sets us ON us.user_id = ce.user_id AND us.set_id = ce.set_id
WHERE ce.trade_flagged = true
  AND ce.duplicate_count = 0
  AND us.set_id IS NULL
ON CONFLICT (user_id, set_id) DO NOTHING;
