-- analytics_events: append-only first-party event log (anon + authed funnel)
create table public.analytics_events (
  id           bigint generated always as identity primary key,
  event_name   text not null,
  anon_id      text not null,
  session_id   text not null,
  user_id      uuid references auth.users(id) on delete set null,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  referrer     text,
  path         text,
  props        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index analytics_events_created_at_idx  on public.analytics_events (created_at);
create index analytics_events_name_created_idx on public.analytics_events (event_name, created_at);
create index analytics_events_anon_idx         on public.analytics_events (anon_id);
create index analytics_events_user_idx         on public.analytics_events (user_id) where user_id is not null;
create index analytics_events_session_idx      on public.analytics_events (session_id);

-- analytics_identity: anon_id -> user_id stitching, written once at signup
create table public.analytics_identity (
  anon_id    text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  linked_at  timestamptz not null default now()
);

create index analytics_identity_user_idx on public.analytics_identity (user_id);

-- RLS enabled, NO client policies. anon/authenticated roles cannot read or write.
-- All writes go through /api/track (service role); all reads through founder
-- SECURITY DEFINER RPCs. Service role and definer-owned functions bypass RLS.
alter table public.analytics_events   enable row level security;
alter table public.analytics_identity enable row level security;
