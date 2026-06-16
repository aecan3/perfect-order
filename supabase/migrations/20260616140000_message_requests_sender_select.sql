-- Message Requests — sender-SELECT RLS (deferred from PART 1).
--
-- The original schema shipped a recipient-only SELECT policy, so a sender who sent a
-- held request had NO way to read it back (Option 1 also writes no messages row), and
-- was therefore blind to what they'd sent / that it was pending. This additive policy
-- lets a sender read the rows they sent.
--
-- A row is now visible to BOTH parties: the sender sees their outgoing request, the
-- recipient sees their incoming one — which is correct. Writes still flow ONLY through
-- the SECURITY DEFINER RPCs (no client write policies). No other policy changes.
CREATE POLICY message_requests_sender_select ON public.message_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id);
