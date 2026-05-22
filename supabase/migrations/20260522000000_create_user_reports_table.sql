CREATE TABLE user_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason            text NOT NULL CHECK (reason IN (
                      'harassment',
                      'scam_fraud',
                      'fake_cards',
                      'inappropriate',
                      'other'
                    )),
  details           text,
  context           text NOT NULL CHECK (context IN ('profile', 'thread')),
  status            text NOT NULL DEFAULT 'open' CHECK (status IN (
                      'open', 'in_progress', 'resolved', 'dismissed'
                    )),
  resolution_note   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,

  CONSTRAINT no_self_report CHECK (reporter_id <> reported_user_id),
  CONSTRAINT details_required_when_other CHECK (
    reason <> 'other' OR (details IS NOT NULL AND length(trim(details)) > 0)
  )
);

CREATE INDEX user_reports_reporter_id_idx ON user_reports(reporter_id);
CREATE INDEX user_reports_reported_user_id_idx ON user_reports(reported_user_id);
CREATE INDEX user_reports_status_idx ON user_reports(status);
CREATE INDEX user_reports_created_at_idx ON user_reports(created_at DESC);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Insert: any authenticated user, must set reporter_id = auth.uid()
-- The no_self_report check constraint also blocks self-reports server-side.
CREATE POLICY user_reports_insert ON user_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Select: reporter sees only their own rows. Admin access via service role
-- only. The reported user MUST NOT be able to see reports filed against them.
CREATE POLICY user_reports_select_own ON user_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- No UPDATE/DELETE policies — clients cannot modify or delete reports.
-- Admin work happens via service role in a future admin queue session.
