begin;
-- Additive migration: existing CMS data, users and media are preserved.
create table if not exists public.cms_visit_events (
  id uuid primary key,
  event_name text not null check (event_name in ('page_view','generate_lead','consultation_click','telephone_click','email_click','resource_download')),
  path text not null,
  visitor_id uuid not null,
  session_id uuid not null,
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create index if not exists cms_visits_date_idx on public.cms_visit_events(occurred_at,id);
create index if not exists cms_visits_session_idx on public.cms_visit_events(session_id,occurred_at);
create table if not exists public.cms_integrations (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cms_visit_events enable row level security;
alter table public.cms_integrations enable row level security;
revoke all on public.cms_visit_events,public.cms_integrations from anon,authenticated;
grant all on public.cms_visit_events,public.cms_integrations to service_role;
-- OAuth credentials are encrypted by the application before storage.

commit;
