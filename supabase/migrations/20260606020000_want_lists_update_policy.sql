-- Allow owners to rename (update title) their want list.
CREATE POLICY "owner update want_lists"
ON want_lists FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Guard the title column: NULL = untitled; non-null must match the API validation rule
-- (same charset and length as the POST /api/want-lists TITLE_RE server check).
ALTER TABLE want_lists
  ADD CONSTRAINT want_lists_title_check
  CHECK (
    title IS NULL
    OR (
      char_length(title) BETWEEN 1 AND 50
      AND title ~ '^[A-Za-z0-9 ''&·.,!?()-]+$'
    )
  );
