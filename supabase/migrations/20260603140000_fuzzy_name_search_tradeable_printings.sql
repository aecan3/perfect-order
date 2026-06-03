-- Add trigram fuzzy matching to card-name side of search_tradeable_printings.
-- Per name token: match via ILIKE (substring/prefix, exact spelling) OR
-- similarity(c.name, tok) > 0.3 (trigram, catches typos like "ninetails" → "Ninetales").
-- Fuzzy is card name only — set names, numbers, and foil keywords stay exact.
-- Threshold 0.3 = pg_trgm default; visible here for easy tuning.
-- Order: similarity(c.name, joined tokens) DESC when name tokens present,
-- so correct spellings still lead over trigram near-misses.
CREATE OR REPLACE FUNCTION public.search_tradeable_printings(
  p_name_tokens  text[]  DEFAULT NULL,
  p_card_number  integer DEFAULT NULL,
  p_print_types  text[]  DEFAULT NULL,
  p_limit        integer DEFAULT 24
)
RETURNS TABLE (
  printing_id    text,
  card_id        text,
  set_id         text,
  card_number    integer,
  printing_type  text,
  collection_tier text,
  card_name      text,
  image_large    text,
  set_name       text,
  set_code       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q   text;
  tok text;
BEGIN
  q := '
    SELECT p.id, p.card_id, p.set_id, p.card_number, p.printing_type, p.collection_tier,
           c.name, c.image_large, s.name, s.code
    FROM printings p
    JOIN cards c ON c.id = p.card_id
    JOIN sets  s ON s.id = p.set_id
    WHERE p.collection_tier IN (''master'', ''grand_master'')
  ';

  -- AND each name token: card name (ILIKE substring OR trigram similarity > 0.3)
  -- OR set name ILIKE substring. Fuzzy applies to card names only.
  IF p_name_tokens IS NOT NULL THEN
    FOREACH tok IN ARRAY p_name_tokens LOOP
      q := q || format(
        ' AND (c.name ILIKE %L OR s.name ILIKE %L OR similarity(c.name, %L) > 0.3)',
        '%%' || tok || '%%',
        '%%' || tok || '%%',
        tok
      );
    END LOOP;
  END IF;

  -- p_card_number is typed integer — safe to inline directly.
  IF p_card_number IS NOT NULL THEN
    q := q || format(' AND p.card_number = %s', p_card_number);
  END IF;

  -- p_print_types comes from the server-side keyword map, not raw user input.
  IF p_print_types IS NOT NULL AND cardinality(p_print_types) > 0 THEN
    q := q || format(' AND p.printing_type = ANY(%L::text[])', p_print_types);
  END IF;

  -- When name tokens are present, sort by trigram similarity DESC so exact/close
  -- matches lead over loose near-misses; then variant display_order within a card.
  -- When no name tokens (number-only or foil-only query), fall back to name ASC.
  IF p_name_tokens IS NOT NULL THEN
    q := q || format(
      ' ORDER BY similarity(c.name, %L) DESC, COALESCE(p.display_order, 999) ASC, p.set_id ASC LIMIT %s',
      array_to_string(p_name_tokens, ' '),
      p_limit
    );
  ELSE
    q := q || format(
      ' ORDER BY c.name ASC, COALESCE(p.display_order, 999) ASC, p.set_id ASC LIMIT %s',
      p_limit
    );
  END IF;

  RETURN QUERY EXECUTE q;
END;
$$;
