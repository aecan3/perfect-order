-- get_marketplace_variety_for_user
-- Returns printing IDs from the user's active-set wish list that have been
-- warmed in the marketplace pool. Used by /api/marketplace/listings to serve
-- a varied feed of eBay tiles for cards the viewer is actively chasing.
--
-- Filters on marketplace_pool.last_refreshed_at IS NOT NULL rather than
-- marketplace_listings.fetched_at so the variety pool stays rich even when
-- some individual listings are slightly stale. The cron's 24-hour full cycle
-- means pool entries are typically refreshed within the past day.
--
-- marketplace_pool.printing_id is text (not uuid), so exclude_printing_ids
-- and the return type are text to match. printings.id is cast to text in the
-- missing_printings CTE for the same reason.

CREATE OR REPLACE FUNCTION get_marketplace_variety_for_user(
  viewer uuid,
  marketplace_id_param text,
  exclude_printing_ids text[],
  limit_count int
)
RETURNS TABLE (printing_id text)
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
  missing_printings AS (
    SELECT p.id::text AS printing_id
    FROM printings p
    WHERE p.set_id IN (SELECT set_id FROM active_sets)
      AND p.id NOT IN (
        SELECT ce2.printing_id
        FROM collection_entries ce2
        WHERE ce2.user_id = viewer
          AND ce2.printing_id IS NOT NULL
      )
  )
  SELECT mp.printing_id
  FROM marketplace_pool mp
  WHERE mp.enabled = true
    AND mp.last_refreshed_at IS NOT NULL
    AND mp.printing_id IN (SELECT m.printing_id FROM missing_printings m)
    AND NOT (mp.printing_id = ANY(exclude_printing_ids))
  ORDER BY random()
  LIMIT limit_count;
END;
$$;
