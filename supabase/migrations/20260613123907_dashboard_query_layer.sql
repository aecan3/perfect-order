-- Founder dashboard query layer (PART 1) — SECURITY DEFINER aggregate RPCs.
-- House style per get_friend_want_lists: SECURITY DEFINER, search_path = public,
-- identity derived from auth.uid() (never a client param), admin-gated in-function
-- (profiles.is_admin) so non-admins get empty results even if EXECUTE is broad.
--
-- Internal/admin exclusion (AUTHED stages only): a "real" user is
--   email NOT ILIKE '%@mastersettertcg.com' AND COALESCE(is_admin,false)=false.
-- Anon/top-of-funnel stages (referral_landing, anon card_added, signup_started)
-- have no user identity and CANNOT be filtered — they include test traffic.
--
-- Stage sources: anon/top stages from analytics_events; authed/bottom stages
-- (signups/activated/d7) from auth.users ground truth (created_at, email_confirmed_at).
-- Daily series bucketed by Sydney day so day boundaries match the founder's locale.

-- ============================================================================
-- 1. dashboard_funnel(days) — one summary row.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_funnel(days int DEFAULT 30)
RETURNS TABLE (
  referral_landings    bigint,
  anon_active_sessions bigint,
  signups_started      bigint,
  signups_completed    bigint,
  activated            bigint,
  d7_retained          bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - (days * interval '1 day');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    -- anon/top stages (unfiltered — include test traffic)
    (SELECT count(*) FROM analytics_events e
       WHERE e.event_name = 'referral_landing' AND e.created_at >= since),
    (SELECT count(DISTINCT e.anon_id) FROM analytics_events e
       WHERE e.event_name = 'card_added' AND e.created_at >= since),
    (SELECT count(*) FROM analytics_events e
       WHERE e.event_name = 'signup_started' AND e.created_at >= since),
    -- authed stages (auth.users ground truth, internal+admin excluded)
    (SELECT count(*) FROM auth.users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.created_at >= since
        AND u.email_confirmed_at IS NOT NULL
        AND u.email NOT ILIKE '%@mastersettertcg.com'
        AND COALESCE(p.is_admin, false) = false),
    (SELECT count(*) FROM auth.users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.created_at >= since
        AND u.email NOT ILIKE '%@mastersettertcg.com'
        AND COALESCE(p.is_admin, false) = false
        AND EXISTS (SELECT 1 FROM collection_entries ce WHERE ce.user_id = u.id)),
    (SELECT count(*) FROM auth.users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.created_at >= since
        AND u.created_at <= now() - interval '7 days'
        AND u.email NOT ILIKE '%@mastersettertcg.com'
        AND COALESCE(p.is_admin, false) = false
        AND (
          EXISTS (SELECT 1 FROM analytics_events e
                   WHERE e.user_id = u.id AND e.created_at >= u.created_at + interval '7 days')
          OR EXISTS (SELECT 1 FROM collection_entries ce
                      WHERE ce.user_id = u.id AND ce.updated_at >= u.created_at + interval '7 days')
        ));
END;
$$;

-- ============================================================================
-- 2. dashboard_acquisition(days) — completed signups grouped by first-touch channel.
--    Channel = the linked anon_id's earliest referral_landing source, else its
--    earliest non-null utm_source, else 'direct'.
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
  linked AS (
    SELECT rs.user_id, ai.anon_id
    FROM real_signups rs
    LEFT JOIN analytics_identity ai ON ai.user_id = rs.user_id
  ),
  sourced AS (
    SELECT l.user_id,
      COALESCE(
        (SELECT e.props->>'source' FROM analytics_events e
          WHERE e.anon_id = l.anon_id AND e.event_name = 'referral_landing'
          ORDER BY e.created_at ASC LIMIT 1),
        (SELECT e.utm_source FROM analytics_events e
          WHERE e.anon_id = l.anon_id AND e.utm_source IS NOT NULL
          ORDER BY e.created_at ASC LIMIT 1),
        'direct'
      ) AS channel
    FROM linked l
  )
  SELECT s.channel, count(*)::bigint AS signups
  FROM sourced s
  GROUP BY s.channel
  ORDER BY signups DESC;
END;
$$;

-- ============================================================================
-- 3. dashboard_ebay(days) — ebay_click breakdown. Long format:
--    dimension='surface' rows (find_online_search vs marketplace_listing) +
--    dimension='set' rows (ranked by clicks). UI splits on `dimension`.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_ebay(days int DEFAULT 30)
RETURNS TABLE (
  dimension text,
  key       text,
  clicks    bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - (days * interval '1 day');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN RETURN; END IF;

  RETURN QUERY
  WITH ev AS (
    SELECT e.props->>'surface' AS surface, e.props->>'set_id' AS set_id
    FROM analytics_events e
    WHERE e.event_name = 'ebay_click' AND e.created_at >= since
  )
  SELECT 'surface'::text, COALESCE(ev.surface, 'unknown'), count(*)::bigint
  FROM ev
  GROUP BY ev.surface
  UNION ALL
  SELECT 'set'::text, ev.set_id, count(*)::bigint
  FROM ev
  WHERE ev.set_id IS NOT NULL
  GROUP BY ev.set_id
  ORDER BY 1, 3 DESC;
END;
$$;

-- ============================================================================
-- 4. dashboard_daily(days) — per Sydney-day series of signups / ebay_clicks /
--    referral_landings, zero-filled across the whole window.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_daily(days int DEFAULT 30)
RETURNS TABLE (
  day               date,
  signups           bigint,
  ebay_clicks       bigint,
  referral_landings bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - (days * interval '1 day');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN RETURN; END IF;

  RETURN QUERY
  WITH days_series AS (
    SELECT generate_series(
      ((now() AT TIME ZONE 'Australia/Sydney')::date - (days - 1))::timestamp,
      ((now() AT TIME ZONE 'Australia/Sydney')::date)::timestamp,
      interval '1 day'
    )::date AS d
  ),
  signups AS (
    SELECT (u.created_at AT TIME ZONE 'Australia/Sydney')::date AS d, count(*)::bigint AS n
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.created_at >= since
      AND u.email_confirmed_at IS NOT NULL
      AND u.email NOT ILIKE '%@mastersettertcg.com'
      AND COALESCE(p.is_admin, false) = false
    GROUP BY 1
  ),
  ebay AS (
    SELECT (e.created_at AT TIME ZONE 'Australia/Sydney')::date AS d, count(*)::bigint AS n
    FROM analytics_events e
    WHERE e.event_name = 'ebay_click' AND e.created_at >= since
    GROUP BY 1
  ),
  ref AS (
    SELECT (e.created_at AT TIME ZONE 'Australia/Sydney')::date AS d, count(*)::bigint AS n
    FROM analytics_events e
    WHERE e.event_name = 'referral_landing' AND e.created_at >= since
    GROUP BY 1
  )
  SELECT ds.d,
         COALESCE(s.n, 0),
         COALESCE(eb.n, 0),
         COALESCE(rf.n, 0)
  FROM days_series ds
  LEFT JOIN signups s  ON s.d  = ds.d
  LEFT JOIN ebay eb    ON eb.d = ds.d
  LEFT JOIN ref rf     ON rf.d = ds.d
  ORDER BY ds.d;
END;
$$;
