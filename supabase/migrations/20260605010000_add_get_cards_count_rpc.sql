-- get_cards_count(p_user_id) — total cards owned across tracked sets.
-- Formula: COUNT(*) + SUM(duplicate_count) over checked, master-tier,
-- user_sets-joined entries. Excludes deleted sets (no user_sets row).
-- duplicate_count semantics: N = N extra copies; total per row = 1 + N.
--
-- SECURITY INVOKER (not DEFINER): executes with the caller's RLS context.
-- /you calls this via anon-key client → RLS restricts to auth.uid() rows.
-- public-stats calls via service-role client → bypasses RLS, reads any user.
-- A DEFINER version would let any authed client enumerate any user's count.
CREATE OR REPLACE FUNCTION public.get_cards_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (COUNT(*) + COALESCE(SUM(ce.duplicate_count), 0))::bigint
  FROM collection_entries ce
  JOIN printings p  ON p.id  = ce.printing_id
  JOIN user_sets us ON us.user_id = ce.user_id AND us.set_id = ce.set_id
  WHERE ce.user_id       = p_user_id
    AND ce.checked        = true
    AND p.collection_tier = 'master';
$$;
