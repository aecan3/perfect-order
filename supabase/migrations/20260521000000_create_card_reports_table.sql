CREATE TABLE card_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category        text NOT NULL CHECK (category IN (
                    'wrong_image',
                    'wrong_name_or_number',
                    'wrong_rarity',
                    'wrong_price',
                    'missing_card_or_variant',
                    'other'
                  )),
  details         text NOT NULL CHECK (length(trim(details)) > 0),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN (
                    'open', 'in_progress', 'resolved', 'dismissed'
                  )),
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX card_reports_reporter_id_idx ON card_reports(reporter_id);
CREATE INDEX card_reports_status_idx ON card_reports(status);
CREATE INDEX card_reports_created_at_idx ON card_reports(created_at DESC);

ALTER TABLE card_reports ENABLE ROW LEVEL SECURITY;

-- Insert: any authenticated user, must set reporter_id = auth.uid()
CREATE POLICY card_reports_insert ON card_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Select: reporter sees only their own rows. Admin access via service role
-- only, no client-side admin role for now.
CREATE POLICY card_reports_select_own ON card_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- No UPDATE/DELETE policies — clients cannot modify or delete reports.
-- Admin work happens via service role in a future admin queue session.
