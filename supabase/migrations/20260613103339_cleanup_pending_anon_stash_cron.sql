-- Cross-device onboarding (PART 3): hourly pg_cron sweep of expired stash rows.
-- pending_anon_stash rows carry a 24h TTL (expires_at). Once expired the email
-- confirmation link is dead too, so the row is useless — a worst-case ~1h lag
-- before deletion is fine and keeps the job light. A lazy opportunistic delete in
-- /api/anon-stash is the active-traffic backstop; this cron covers quiet periods.
-- Neither mechanism is load-bearing alone.

-- 1. Ensure pg_cron is enabled (idempotent no-op if already present).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the hourly cleanup. Idempotent: unschedule first if a job with this
--    name already exists, so re-applying the migration never errors.
SELECT cron.unschedule('cleanup_pending_anon_stash')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup_pending_anon_stash'
);

SELECT cron.schedule(
  'cleanup_pending_anon_stash',
  '0 * * * *',
  $$DELETE FROM public.pending_anon_stash WHERE expires_at < now()$$
);
