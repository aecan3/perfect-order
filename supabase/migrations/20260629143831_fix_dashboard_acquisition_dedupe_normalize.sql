-- ============================================================================
-- Fix dashboard_acquisition(days): de-duplicate completed signups + normalize labels.
--
-- Two bugs fixed (CREATE OR REPLACE — signature unchanged):
--  (1) Over-count: the previous `linked` CTE LEFT JOINed analytics_identity
--      1-user -> many-anon_id, and count(*) counted per (user, anon_id) pair, so a
--      cross-device signup (e.g. IG WebView anon = instagram, Safari anon = naked ->
--      direct) was counted in BOTH buckets. The fan-out is now absorbed INSIDE the
--      subqueries (JOIN analytics_identity ai ON ai.user_id = rs.user_id), so channel
--      is the earliest real touch across ALL of a user's anon_ids — one row per user.
--  (2) Label fragmentation: referral_landing source uses full words
--      (instagram/youtube/tiktok) while utm_source uses abbreviations (ig/yt/tt). A
--      normalization CASE collapses ig->instagram, yt->youtube, tt->tiktok.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_acquisition(days int DEFAULT 30)
RETURNS TABLE (
  channel text,
  signups bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - (days * interval '1 day');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN RETURN; END IF;

  RETURN QUERY
  WITH real_signups AS (
    SELECT u.id AS user_id
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.created_at >= since
      AND u.email_confirmed_at IS NOT NULL
      AND u.email NOT ILIKE '%@mastersettertcg.com'
      AND COALESCE(p.is_admin, false) = false
  ),
  sourced AS (
    SELECT
      rs.user_id,
      COALESCE(
        (SELECT e.props->>'source'
           FROM analytics_events e
           JOIN analytics_identity ai ON ai.anon_id = e.anon_id
          WHERE ai.user_id = rs.user_id
            AND e.event_name = 'referral_landing'
            AND e.props->>'source' IS NOT NULL
          ORDER BY e.created_at ASC
          LIMIT 1),
        (SELECT e.utm_source
           FROM analytics_events e
           JOIN analytics_identity ai ON ai.anon_id = e.anon_id
          WHERE ai.user_id = rs.user_id
            AND e.utm_source IS NOT NULL
          ORDER BY e.created_at ASC
          LIMIT 1),
        'direct'
      ) AS raw_channel
    FROM real_signups rs
  )
  SELECT
    CASE lower(s.raw_channel)
      WHEN 'ig' THEN 'instagram'
      WHEN 'yt' THEN 'youtube'
      WHEN 'tt' THEN 'tiktok'
      ELSE lower(s.raw_channel)
    END AS channel,
    count(DISTINCT s.user_id)::bigint AS signups
  FROM sourced s
  GROUP BY 1
  ORDER BY signups DESC;
END;
$$;
