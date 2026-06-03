-- Fix search_tradeable_printings for group integrity + higher ceiling.
--
-- ORDER BY change: add p.card_id before p.set_id so all printings of the same
-- card-in-a-set are always contiguous in the result. Previously, two cards with
-- equal similarity scores (e.g. "Gengar" and "Gengar & Mimikyu") could interleave,
-- splitting a card's printings across the result slice.
--
-- New ordering:
--   name tokens present: similarity(c.name, joined) DESC, c.name ASC, p.card_id ASC, p.set_id ASC, p.printing_type ASC
--   no name tokens:      c.name ASC, p.card_id ASC, p.set_id ASC, p.printing_type ASC
--
-- p_limit default raised to 200 (route passes 200 explicitly; this keeps the signature
-- consistent and prevents accidental bare calls from hitting the old 24 ceiling).
CREATE OR REPLACE FUNCTION public.search_tradeable_printings(
  p_name_tokens  text[]  DEFAULT NULL,
  p_card_number  integer DEFAULT NULL,
  p_print_types  text[]  DEFAULT NULL,
  p_limit        integer DEFAULT 200
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

  -- Group-integrity ordering: card_id before set_id ensures all printings of the same
  -- card-in-a-set are always contiguous, regardless of where the result is sliced.
  -- c.name ASC after similarity breaks ties between equal-score cards alphabetically.
  IF p_name_tokens IS NOT NULL THEN
    q := q || format(
      ' ORDER BY similarity(c.name, %L) DESC, c.name ASC, p.card_id ASC, p.set_id ASC, p.printing_type ASC LIMIT %s',
      array_to_string(p_name_tokens, ' '),
      p_limit
    );
  ELSE
    q := q || format(
      ' ORDER BY c.name ASC, p.card_id ASC, p.set_id ASC, p.printing_type ASC LIMIT %s',
      p_limit
    );
  END IF;

  RETURN QUERY EXECUTE q;
END;
$$;
