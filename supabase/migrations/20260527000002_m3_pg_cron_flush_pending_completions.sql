-- M3 pg_cron: flush set_completed_pending rows after 5-min settle.
-- Stays on Vercel Hobby (Vercel cron is daily-only on that tier).
-- Schedule: every 5 minutes. Worst-case settle delay = 5 min settle + 5 min cron = 10 min.
--
-- PARITY WITH JS-SIDE computeOwnershipPct
--
-- This function reimplements lib/feed-progression.js's
-- computeOwnershipPct in SQL. The two must stay in sync.
--
-- If you change the master-tier filter (collection_tier = 'master'),
-- the join shape, or the rounding (Math.round in JS, round() in SQL)
-- here, you MUST also update the JS helper.
--
-- Drift will cause set_completed events to fire incorrectly:
--   - SQL flushes rows the route thinks should still be pending, OR
--   - SQL refuses to flush rows the route's threshold logic considers complete.

-- 1. Ensure pg_cron extension is enabled.
--    Idempotent — does nothing if already enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. The flush function.
CREATE OR REPLACE FUNCTION flush_pending_completions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settle_window interval := interval '5 minutes';
  pending_row record;
  master_total int;
  owned_count int;
  current_pct int;
BEGIN
  -- Iterate all pending rows older than the settle window.
  FOR pending_row IN
    SELECT user_id, set_id
    FROM set_completed_pending
    WHERE crossed_at <= now() - settle_window
  LOOP
    -- Compute master-tier total (GM excluded via collection_tier = 'master' filter,
    -- matching selectMasterPrintings in lib/queries/printings.js)
    SELECT count(*) INTO master_total
    FROM printings
    WHERE set_id = pending_row.set_id
      AND collection_tier = 'master';

    -- Skip if the set has no master printings (data anomaly, very unlikely).
    IF master_total = 0 THEN
      DELETE FROM set_completed_pending
      WHERE user_id = pending_row.user_id AND set_id = pending_row.set_id;
      CONTINUE;
    END IF;

    -- Compute current owned count for this user+set, master printings only.
    SELECT count(*) INTO owned_count
    FROM collection_entries ce
    INNER JOIN printings p ON p.id = ce.printing_id
    WHERE ce.user_id = pending_row.user_id
      AND ce.set_id = pending_row.set_id
      AND ce.checked = true
      AND p.collection_tier = 'master';

    current_pct := round((owned_count::numeric / master_total::numeric) * 100);

    -- If still at 100%, fire the set_completed event.
    -- 23505 (unique violation) is treated as silent no-op in case of races.
    IF current_pct >= 100 THEN
      BEGIN
        INSERT INTO feed_events (actor_user_id, event_type, related_set_id, metadata)
        VALUES (
          pending_row.user_id,
          'set_completed',
          pending_row.set_id,
          jsonb_build_object('pct', current_pct)
        );
      EXCEPTION WHEN unique_violation THEN
        -- Already fired by a concurrent path — accept and continue.
        NULL;
      END;
    END IF;

    -- Always delete the pending row, whether fired or dropped.
    DELETE FROM set_completed_pending
    WHERE user_id = pending_row.user_id AND set_id = pending_row.set_id;
  END LOOP;
END;
$$;

-- 3. Schedule the function via pg_cron.
--    Idempotent: if a job with the same name exists, unschedule first.
SELECT cron.unschedule('flush_pending_completions')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'flush_pending_completions'
);

SELECT cron.schedule(
  'flush_pending_completions',
  '*/5 * * * *',
  $$SELECT flush_pending_completions()$$
);
