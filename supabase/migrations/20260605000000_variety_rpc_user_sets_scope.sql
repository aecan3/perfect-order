-- Fix get_marketplace_variety_for_user: scope active_sets to user_sets instead of
-- collection_entries. Deleting a set removes its user_sets row but leaves
-- collection_entries intact (non-destructive by design), so the old CTE would
-- count deleted sets as active. Now active = sets the user currently tracks.
--
-- Only the active_sets CTE changes. Everything else is byte-identical to
-- 20260601000003_marketplace_variety_widen_fix_ambiguous_col.sql.
--
-- DROP FUNCTION is required here because an intermediate incorrect migration
-- (20260605000000, now replaced by this file) accidentally deployed a stripped
-- single-column overload. This DROP cleans that up before restoring the correct
-- two-column signature.
DROP FUNCTION IF EXISTS get_marketplace_variety_for_user(uuid, text, text[], int);

CREATE OR REPLACE FUNCTION get_marketplace_variety_for_user(
  viewer uuid,
  marketplace_id_param text,
  exclude_printing_ids text[],
  limit_count int
)
RETURNS TABLE (printing_id text, is_active_set boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_sets AS (
    SELECT us.set_id
    FROM user_sets us
    WHERE us.user_id = viewer
  ),
  user_owned AS (
    SELECT DISTINCT ce.printing_id AS owned_id
    FROM collection_entries ce
    WHERE ce.user_id = viewer
      AND ce.printing_id IS NOT NULL
  ),
  candidates AS (
    SELECT
      p.id::text AS printing_id,
      (p.set_id IN (SELECT set_id FROM active_sets)) AS is_active_set
    FROM printings p
    WHERE p.id::text NOT IN (SELECT uo.owned_id FROM user_owned uo)
  )
  SELECT
    c.printing_id,
    c.is_active_set
  FROM candidates c
  WHERE EXISTS (
    SELECT 1
    FROM marketplace_listings ml
    WHERE ml.printing_id = c.printing_id
      AND ml.marketplace_id = marketplace_id_param
      AND ml.fetched_at > NOW() - INTERVAL '2880 minutes'
  )
  AND NOT (c.printing_id = ANY(exclude_printing_ids))
  ORDER BY
    c.is_active_set DESC,
    random()
  LIMIT limit_count;
END;
$$;
