-- Stage 1: add trade_flagged to collection_entries and update all binder-read
-- paths to honour it. Binder membership: duplicate_count > 0 OR trade_flagged = true.
-- Existing checked = true and collection_tier = 'master' gates are untouched.
--
-- DB-side read paths updated here:
--   1. collection_entries column (additive — no existing data touched)
--   2. get_user_duplicates RPC (owner + public binder view)
--   3. "anon can read public duplicates" RLS policy (anonymous binder view)
--
-- App-side read paths updated in the same commit:
--   4. lib/queries/discover.js   — friends' spares in Discover feed
--   5. public-stats/route.js     — DUPES count on profile preview cards

ALTER TABLE public.collection_entries
  ADD COLUMN trade_flagged boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_user_duplicates(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_user_duplicates(target_user uuid, viewer uuid)
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
  rarity           text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.printing_id,
    c.name               AS card_name,
    ce.card_number,
    ce.set_id,
    s.name               AS set_name,
    s.logo_url           AS set_logo_url,
    c.image_large        AS image_url,
    p.price_usd,
    ce.duplicate_count,
    EXISTS (
      SELECT 1 FROM favourites f
      WHERE f.user_id = viewer
        AND f.printing_id = ce.printing_id
    )                    AS hunted_by_viewer,
    c.rarity             AS rarity
  FROM collection_entries ce
  JOIN printings p ON p.id = ce.printing_id
  JOIN cards c     ON c.id = p.card_id
  JOIN sets s      ON s.id = ce.set_id
  WHERE ce.user_id       = target_user
    AND (ce.duplicate_count > 0 OR ce.trade_flagged = true)
    AND ce.checked        = true
    AND p.collection_tier = 'master'
  ORDER BY hunted_by_viewer DESC, p.price_usd DESC NULLS LAST;
END;
$$;

DROP POLICY IF EXISTS "anon can read public duplicates" ON public.collection_entries;
CREATE POLICY "anon can read public duplicates"
  ON public.collection_entries
  FOR SELECT TO anon
  USING (duplicate_count > 0 OR trade_flagged = true);
