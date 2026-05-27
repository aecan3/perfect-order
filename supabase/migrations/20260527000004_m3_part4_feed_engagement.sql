-- M3 PART 4: Feed engagement (likes + comments).
-- Two tables, RLS enabled, real-time subscription support.
-- See HANDOVER.md §19 Milestone 3 for design rationale.

-- 1. feed_event_likes
-- One row per (event, user). Composite primary key prevents duplicate likes.
-- DELETE on unlike — no soft delete.
CREATE TABLE IF NOT EXISTS feed_event_likes (
  event_id uuid NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_event_likes_event_id ON feed_event_likes (event_id);
CREATE INDEX IF NOT EXISTS idx_feed_event_likes_user_id ON feed_event_likes (user_id);

ALTER TABLE feed_event_likes ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the underlying feed_event can see the likes.
-- feed_events RLS already filters to friends-only (session 10), so likes are
-- transitively also friends-only.
CREATE POLICY "feed_event_likes_select"
ON feed_event_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM feed_events fe WHERE fe.id = feed_event_likes.event_id
  )
);

-- Users can only INSERT/DELETE their own likes.
CREATE POLICY "feed_event_likes_insert_own"
ON feed_event_likes FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_event_likes_delete_own"
ON feed_event_likes FOR DELETE
USING (user_id = auth.uid());

-- 2. feed_event_comments
-- One row per comment. Soft delete via deleted_at column (for moderation).
CREATE TABLE IF NOT EXISTS feed_event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_feed_event_comments_event_id ON feed_event_comments (event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feed_event_comments_author_id ON feed_event_comments (author_id);

ALTER TABLE feed_event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_event_comments_select"
ON feed_event_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM feed_events fe WHERE fe.id = feed_event_comments.event_id
  )
  AND deleted_at IS NULL
);

CREATE POLICY "feed_event_comments_insert_own"
ON feed_event_comments FOR INSERT
WITH CHECK (author_id = auth.uid());

-- Users can soft-delete their own comments.
CREATE POLICY "feed_event_comments_update_own"
ON feed_event_comments FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- 3. Add new tables to supabase_realtime publication.
-- See HANDOVER §17: "Supabase real-time requires explicit publication membership."
ALTER PUBLICATION supabase_realtime ADD TABLE feed_event_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE feed_event_comments;
