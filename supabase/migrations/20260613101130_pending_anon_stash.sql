-- pending_anon_stash: server-side stash of an anonymous collection captured at
-- signup-start, keyed by normalised (lowercase+trim) email. Lets a cross-device
-- confirm (sign up on desktop, confirm on phone) recover the collection that
-- otherwise lives only in the signup device's localStorage. Written by
-- POST /api/anon-stash (service role) just before supabase.auth.signUp; read and
-- migrated by the confirm page (PART 2). Rows carry the original signup-device
-- anon_id for the analytics identity stitch, and a 24h TTL swept later (PART 3).
create table public.pending_anon_stash (
  email       text primary key,
  entries     jsonb not null default '[]'::jsonb,
  set_modes   jsonb not null default '{}'::jsonb,
  anon_id     text,
  started_at  timestamptz,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);

create index idx_pending_anon_stash_expires on public.pending_anon_stash (expires_at);

-- RLS enabled, NO client policies. anon + authenticated roles get zero access;
-- the stash is written and read exclusively by the service-role client
-- (getServiceClient), which bypasses RLS. No client ever touches this table.
alter table public.pending_anon_stash enable row level security;
