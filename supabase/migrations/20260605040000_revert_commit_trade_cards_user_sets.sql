-- Revert: remove the hidden user_sets upsert from commit_trade_cards.
-- The correct approach is to amend get_cards_count to include trade_flagged
-- entries directly (see migration 20260605050000), not to resurrect deleted sets.
--
-- Also delete the backfilled hidden user_sets rows created by migration
-- 20260605030000. Identified by added_at = hidden_at (both were set to NOW()
-- in the same INSERT — legitimate rows always have these at different times).
-- Guard: only delete where a flagged-only entry exists in that set, so this
-- cannot touch rows a user hid themselves (those rows have added_at < hidden_at).

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

-- Delete backfill-created rows (added_at = hidden_at fingerprint).
DELETE FROM user_sets
WHERE hidden_at IS NOT NULL
  AND added_at = hidden_at
  AND EXISTS (
    SELECT 1 FROM collection_entries ce
    WHERE ce.user_id = user_sets.user_id
      AND ce.set_id  = user_sets.set_id
      AND ce.trade_flagged   = true
      AND ce.duplicate_count = 0
  );
