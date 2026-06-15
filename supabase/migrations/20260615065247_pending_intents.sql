-- pending_intents: server-side carrier for a signup's trade intent, keyed to the
-- NEW user's id. Needed because the branded confirmation email hardcodes the
-- /auth/confirm URL (stripping emailRedirectTo's query params) and opens in a
-- different storage context — so the URL, sessionStorage, and localStorage carriers
-- all fail at confirm. A DB row keyed by user_id is the only carrier that survives.
--
-- Written by the service-role route POST /api/pending-intent at signup time (no
-- client session exists yet — confirmation-ON signUp returns session:null, so
-- auth.uid() is NULL client-side and a client RLS insert is impossible). Read +
-- deleted by the confirm page acting as the new user (post-verifyOtp auth.uid()).
create table public.pending_intents (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  intent_type        text not null,
  intent_subtype     text,
  sharer_handle      text,
  target_printing_id text,
  target_card_name   text,
  created_at         timestamptz not null default now()
);

alter table public.pending_intents enable row level security;

-- SELECT/DELETE: the confirm client, acting as the new user, reads + consumes its own row.
create policy "own pending intent select" on public.pending_intents
  for select using (auth.uid() = user_id);
create policy "own pending intent delete" on public.pending_intents
  for delete using (auth.uid() = user_id);

-- No INSERT/UPDATE policy: the ONLY writer is the service-role route (bypasses RLS).
-- Omitting them means no client can ever write the table directly — intentional.
