-- Want Lists: point-in-time snapshot of a user's missing card slots.
--
-- Snapshot unit is the MISSING SLOT, not the printing:
--   - 'any' mode  → one row per missing slot (stripEditionPrefix group), edition_label
--                   is the humanized variant + "· Any edition" only when the slot has 2+
--                   edition printings (e.g. "Reverse Holo · Any edition" vs "Reverse Holo").
--   - 'all' mode  → one row per missing printing individually.
--   - single-ed   → one row per missing printing in that edition.
--
-- printing_id is a snapshot text reference (no FK — printings are never deleted,
-- but we deliberately avoid ON DELETE CASCADE on a public snapshot table).
-- At display time the public API route JOINs printings for current image_url / price_usd.
--
-- Public access: NO USING(true) select policies — want lists are public-by-link,
-- not enumerable. The public page fetches via a service-role API route. RLS for
-- client-side access is owner-only.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.want_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.want_list_cards (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  want_list_id uuid        NOT NULL REFERENCES public.want_lists(id) ON DELETE CASCADE,
  set_id       text        NOT NULL,
  card_number  integer     NOT NULL,
  printing_id  text        NOT NULL,
  edition_label text       NOT NULL
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX ON public.want_lists (user_id);
CREATE INDEX ON public.want_list_cards (want_list_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.want_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.want_list_cards ENABLE ROW LEVEL SECURITY;

-- want_lists: owner read/write only (service role bypasses for public API route)
CREATE POLICY "owner read want lists"
  ON public.want_lists FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "owner insert want lists"
  ON public.want_lists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner delete want lists"
  ON public.want_lists FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- want_list_cards: scoped through parent want_list ownership
CREATE POLICY "owner read want list cards"
  ON public.want_list_cards FOR SELECT TO authenticated
  USING (
    want_list_id IN (SELECT id FROM public.want_lists WHERE user_id = auth.uid())
  );

CREATE POLICY "owner insert want list cards"
  ON public.want_list_cards FOR INSERT TO authenticated
  WITH CHECK (
    want_list_id IN (SELECT id FROM public.want_lists WHERE user_id = auth.uid())
  );

CREATE POLICY "owner delete want list cards"
  ON public.want_list_cards FOR DELETE TO authenticated
  USING (
    want_list_id IN (SELECT id FROM public.want_lists WHERE user_id = auth.uid())
  );
