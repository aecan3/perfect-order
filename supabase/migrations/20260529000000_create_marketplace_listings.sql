-- marketplace_listings: cached eBay (and future source) Buy It Now listings,
-- matched to a specific printing in our DB.
-- Source-agnostic: source column is 'ebay' for now; future values could be
-- 'cardmarket', 'tcgplayer', 'store:*', etc.
-- image_url is the SELLER's photo — used only in the detail overlay, never on tiles.
-- Tile art always comes from cards.image_large via the printing join.

CREATE TABLE marketplace_listings (
  source              text        NOT NULL,
  source_listing_id   text        NOT NULL,
  printing_id         text        NOT NULL REFERENCES printings(id),
  set_id              text        NOT NULL,
  card_number         integer     NOT NULL,
  title               text,
  price_amount        numeric,
  price_currency      text,
  image_url           text,
  listing_url         text        NOT NULL,
  seller_username     text,
  seller_feedback_pct numeric,
  condition           text,
  marketplace_id      text,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_listing_id)
);

CREATE INDEX marketplace_listings_printing_fetched_idx
  ON marketplace_listings (printing_id, fetched_at DESC);

CREATE INDEX marketplace_listings_set_card_fetched_idx
  ON marketplace_listings (set_id, card_number, fetched_at DESC);

-- RLS: any signed-in user can read (public eBay data, just cached).
-- Writes are service-role only — no end-user INSERT/UPDATE/DELETE policies.
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_listings_select"
  ON marketplace_listings
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
