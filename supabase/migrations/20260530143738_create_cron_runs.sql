CREATE TABLE cron_runs (
  id              bigserial    PRIMARY KEY,
  route           text         NOT NULL,
  started_at      timestamptz  NOT NULL DEFAULT now(),
  duration_ms     integer      NOT NULL,
  batch_size      integer      NOT NULL,
  refreshed       integer      NOT NULL DEFAULT 0,
  errors          integer      NOT NULL DEFAULT 0,
  metadata        jsonb
);

CREATE INDEX cron_runs_route_started_idx ON cron_runs (route, started_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = service role only. Query via SQL editor.
