-- Admin SELECT: admins can read all card reports.
-- The existing card_reports_select_own policy stays; PostgreSQL ORs permissive
-- policies so reporters still see only their own reports.
CREATE POLICY "card_reports_admin_select_all" ON card_reports
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
));

-- Admin UPDATE: admins can update card reports (resolve, reopen, status changes).
CREATE POLICY "card_reports_admin_update" ON card_reports
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
));
