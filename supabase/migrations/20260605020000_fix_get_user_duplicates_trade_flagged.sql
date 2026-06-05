-- Extend get_user_duplicates to include trade_flagged=true cards (not just dup>0).
-- Also adds trade_flagged to the return table so the client can distinguish
-- binder-only cards (flagged, dup=0) from dupe-fed cards (dup>0).
-- DROP required because PostgreSQL cannot change a function's return type in place.

DROP FUNCTION IF EXISTS public.get_user_duplicates(uuid, uuid);

CREATE FUNCTION public.get_user_duplicates(target_user uuid, viewer uuid)
RETURNS TABLE (
  printing_id      text,
  card_name        text,
  card_number      integer,
  set_id           text,
  set_name         text,
  set_logo_url     text,
  image_url        text,
  price_usd        numeric,
  duplicate_count  integer,
  hunted_by_viewer boolean,
  rarity           text,
  trade_flagged    boolean
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
    s.logo_url            AS set_logo_url,
    c.image_large         AS image_url,
    p.price_usd,
    ce.duplicate_count,
    EXISTS (
      SELECT 1 FROM favourites f
      WHERE f.user_id = viewer
        AND f.printing_id = ce.printing_id
    )                     AS hunted_by_viewer,
    c.rarity              AS rarity,
    ce.trade_flagged
  FROM collection_entries ce
  JOIN printings p ON p.id = ce.printing_id
  JOIN cards c     ON c.id = p.card_id
  JOIN sets s      ON s.id = ce.set_id
  WHERE ce.user_id       = target_user
    AND ce.checked        = true
    AND p.collection_tier = 'master'
    AND (ce.duplicate_count > 0 OR ce.trade_flagged = true)
  ORDER BY hunted_by_viewer DESC, p.price_usd DESC NULLS LAST;
END;
$$;
