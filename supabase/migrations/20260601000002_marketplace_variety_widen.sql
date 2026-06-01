-- Drop previous text[] overload before redefining — return type changes
-- from TABLE(printing_id text) to TABLE(printing_id text, is_active_set boolean),
-- and CREATE OR REPLACE does not replace across signature changes.
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
    SELECT DISTINCT ce.set_id
    FROM collection_entries ce
    WHERE ce.user_id = viewer
      AND ce.checked = true
  ),
  user_owned AS (
    SELECT DISTINCT ce.printing_id
    FROM collection_entries ce
    WHERE ce.user_id = viewer
      AND ce.printing_id IS NOT NULL
  ),
  candidates AS (
    SELECT
      p.id::text AS printing_id,
      (p.set_id IN (SELECT set_id FROM active_sets)) AS is_active_set
    FROM printings p
    WHERE p.id::text NOT IN (SELECT printing_id FROM user_owned)
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
