-- Trade Binder Phase 2: enable anonymous read access for the public
-- binder route. Extends four existing public-data policies to the anon
-- role, and adds a new policy for collection_entries scoped narrowly
-- to tradeable rows (duplicate_count > 0).
--
-- Side note: the existing policies are named "anyone can read X" but
-- were actually {authenticated}-only. The names are now accurate.

-- Card metadata is non-sensitive; extend to anon
ALTER POLICY "anyone can read cards"     ON cards     TO authenticated, anon;
ALTER POLICY "anyone can read printings" ON printings TO authenticated, anon;
ALTER POLICY "anyone can read sets"      ON sets      TO authenticated, anon;

-- Profile fields are limited to handle/display_name/avatar_url (no PII).
-- Anonymous binder visitors need this to resolve [handle] → user_id and
-- render the owner's display name/avatar.
ALTER POLICY "profiles are viewable by authenticated users" ON profiles TO authenticated, anon;

-- collection_entries: new anon-only SELECT policy scoped to tradeable rows.
-- Cannot reuse existing policies because their quals use auth.uid().
CREATE POLICY "anon can read public duplicates"
  ON collection_entries
  FOR SELECT
  TO anon
  USING (duplicate_count > 0);
