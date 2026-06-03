-- Search master+grand_master printings with token-based filtering.
-- Each name token ANDs across (cards.name ILIKE %tok% OR sets.name ILIKE %tok%).
-- Called from app/api/trade-binder/search/route.js.
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

  -- AND each name token: printing qualifies if card name OR set name contains it.
  -- format(''%L'') properly escapes user-supplied text to prevent SQL injection.
  IF p_name_tokens IS NOT NULL THEN
    FOREACH tok IN ARRAY p_name_tokens LOOP
      q := q || format(
        ' AND (c.name ILIKE %L OR s.name ILIKE %L)',
        '%%' || tok || '%%',
        '%%' || tok || '%%'
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

  q := q || format(
    ' ORDER BY c.name ASC, COALESCE(p.display_order, 999) ASC, p.set_id ASC LIMIT %s',
    p_limit
  );

  RETURN QUERY EXECUTE q;
END;
$$;
