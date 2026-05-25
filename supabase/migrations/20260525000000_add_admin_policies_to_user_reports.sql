-- Admin SELECT: admins can read all user reports.
-- The existing user_reports_select_own policy stays; PostgreSQL ORs permissive
-- policies so regular users still see only their own reports.
CREATE POLICY "user_reports_admin_select_all" ON user_reports
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
));

-- Admin UPDATE: admins can update user reports (dismiss sets status + resolved_at).
CREATE POLICY "user_reports_admin_update" ON user_reports
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
));
