-- Avatar upload foundation: profiles.avatar_url column + storage bucket + RLS.

-- 1. Add avatar_url to profiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create the avatars storage bucket (public-read).
-- Avatars are shown to friends across the app (feed, profiles, friends
-- list), so the bucket must be public-read. Write access is RLS-scoped
-- to the owner's folder below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for the avatars bucket.
-- Path convention: {user_id}/avatar.webp — the first path segment is the
-- owner's user_id, which we check against auth.uid().

-- Anyone can READ avatars (public bucket, but explicit policy for clarity).
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Users can INSERT only into their own folder.
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can UPDATE (overwrite) only their own avatar.
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can DELETE only their own avatar.
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
