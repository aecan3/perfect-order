-- Amend get_cards_count: count checked master-tier entries where EITHER a
-- matching user_sets row exists (tracked set) OR the entry is trade_flagged=true
-- (binder-only card, possibly from a deleted/untracked set).
--
-- Change: INNER JOIN user_sets → LEFT JOIN user_sets + WHERE condition.
-- This means:
--   - Tracked-set cards: included via us.set_id IS NOT NULL (unchanged behaviour)
--   - Flagged binder-only cards in untracked sets: included via trade_flagged=true
--   - Deleted-set cards that are not flagged: still excluded (correct)
--   - Flagged card in a tracked set: LEFT JOIN finds the row (IS NOT NULL),
--     OR trade_flagged is true — either way the CE row appears exactly ONCE.
--     No double-count possible: this is a WHERE predicate on a single row.
--
-- Replaces: 20260605010000_add_get_cards_count_rpc.sql

CREATE OR REPLACE FUNCTION public.get_cards_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (COUNT(*) + COALESCE(SUM(ce.duplicate_count), 0))::bigint
  FROM collection_entries ce
  JOIN printings p ON p.id = ce.printing_id
  LEFT JOIN user_sets us ON us.user_id = ce.user_id AND us.set_id = ce.set_id
  WHERE ce.user_id        = p_user_id
    AND ce.checked         = true
    AND p.collection_tier  = 'master'
    AND (us.set_id IS NOT NULL OR ce.trade_flagged = true);
$$;
