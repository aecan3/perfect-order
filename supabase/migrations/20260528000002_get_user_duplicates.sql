-- Duplicates storefront query function.
-- Returns a target user's spare cards (duplicate_count > 0, master-tier),
-- enriched with whether the viewer has favourited (is hunting) each printing.
-- Viewer and target_user can be the same for the own-page case.

CREATE OR REPLACE FUNCTION get_user_duplicates(target_user uuid, viewer uuid)
RETURNS TABLE (
  printing_id    text,
  card_name      text,
  card_number    integer,
  set_id         text,
  set_name       text,
  image_url      text,
  price_usd      numeric,
  duplicate_count integer,
  hunted_by_viewer boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.printing_id,
    c.name                AS card_name,
    ce.card_number,
    ce.set_id,
    s.name                AS set_name,
    p.image_url,
    p.price_usd,
    ce.duplicate_count,
    EXISTS (
      SELECT 1 FROM favourites f
      WHERE f.user_id = viewer
        AND f.printing_id = ce.printing_id
    )                     AS hunted_by_viewer
  FROM collection_entries ce
  JOIN printings p ON p.id = ce.printing_id
  JOIN cards c     ON c.id = p.card_id
  JOIN sets s      ON s.id = ce.set_id
  WHERE ce.user_id        = target_user
    AND ce.duplicate_count > 0
    AND ce.checked         = true
    AND p.collection_tier  = 'master'
  ORDER BY hunted_by_viewer DESC, p.price_usd DESC NULLS LAST;
END;
$$;
