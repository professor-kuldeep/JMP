-- JM Pabari CoreTax CMS v6 - Supabase schema
-- Run this entire file once in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.cms_settings (
  id integer primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_menus (
  id integer primary key check (id = 1),
  data jsonb not null default '{"header":[],"footer":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_pages (
  id bigint primary key,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published')),
  order_num integer not null default 99,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cms_pages_status_idx on public.cms_pages(status);
create index if not exists cms_pages_order_idx on public.cms_pages(order_num);

create table if not exists public.cms_enquiries (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cms_enquiries_created_idx on public.cms_enquiries(created_at desc);

create table if not exists public.cms_media (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_revisions (
  id text primary key,
  page_id bigint not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);
create index if not exists cms_revisions_page_idx on public.cms_revisions(page_id, created_at desc);

create table if not exists public.cms_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  email text not null unique,
  role text not null default 'editor',
  totp_secret text not null default '',
  two_factor_enabled boolean not null default true,
  recovery_code_hashes jsonb not null default '[]'::jsonb,
  disabled boolean not null default false,
  must_change_password boolean not null default true,
  source text not null default 'cms-supabase',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_admin_sessions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  role text not null,
  must_change_password boolean not null default false,
  csrf_token text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  ip_hash text not null default '',
  ip_hint text not null default '',
  ua_hash text not null default '',
  user_agent text not null default '',
  revoked boolean not null default false
);
create index if not exists cms_sessions_user_idx on public.cms_admin_sessions(user_id);
create index if not exists cms_sessions_expiry_idx on public.cms_admin_sessions(absolute_expires_at);

create table if not exists public.cms_audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid null,
  username text not null default 'anonymous',
  role text not null default 'unknown',
  action text not null,
  target text not null default '',
  ip text not null default '',
  user_agent text not null default '',
  details jsonb not null default '{}'::jsonb
);
create index if not exists cms_audit_at_idx on public.cms_audit_logs(at desc);

create table if not exists public.cms_rate_limits (
  key text primary key,
  current_count integer not null default 0,
  expires_at timestamptz not null
);

create table if not exists public.cms_totp_uses (
  fingerprint text primary key,
  expires_at timestamptz not null
);

-- Atomic rate limiter used by login and contact forms.
create or replace function public.coretax_consume_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns table(allowed boolean, current_count integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_count integer;
  row_expiry timestamptz;
begin
  delete from public.cms_rate_limits where expires_at <= now();
  insert into public.cms_rate_limits(key, current_count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    current_count = case when public.cms_rate_limits.expires_at <= now() then 1 else public.cms_rate_limits.current_count + 1 end,
    expires_at = case when public.cms_rate_limits.expires_at <= now() then now() + make_interval(secs => p_window_seconds) else public.cms_rate_limits.expires_at end
  returning cms_rate_limits.current_count, cms_rate_limits.expires_at into row_count, row_expiry;
  return query select row_count <= p_max, row_count, greatest(0, ceil(extract(epoch from (row_expiry - now())))::integer);
end;
$$;

-- The application uses the service-role key on server-only API routes.
-- Keep direct browser access locked down unless you intentionally add policies.
alter table public.cms_settings enable row level security;
alter table public.cms_menus enable row level security;
alter table public.cms_pages enable row level security;
alter table public.cms_enquiries enable row level security;
alter table public.cms_media enable row level security;
alter table public.cms_revisions enable row level security;
alter table public.cms_profiles enable row level security;
alter table public.cms_admin_sessions enable row level security;
alter table public.cms_audit_logs enable row level security;
alter table public.cms_rate_limits enable row level security;
alter table public.cms_totp_uses enable row level security;

-- Public media bucket. Upload/delete are still performed server-side with service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms-media','cms-media',true,8388608,array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public=true, file_size_limit=8388608,
allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','application/pdf'];

-- Allow public read of objects in this public CMS bucket. No public write policy is created.
drop policy if exists "CoreTax public media read" on storage.objects;
create policy "CoreTax public media read" on storage.objects for select using (bucket_id = 'cms-media');
