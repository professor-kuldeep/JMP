-- v9: additive CRM, transactional outbox, booking, monitoring and backup metadata.
begin;
create extension if not exists btree_gist;
lock table public.cms_enquiries in share row exclusive mode;
create sequence if not exists public.cms_enquiries_id_seq;
select setval('public.cms_enquiries_id_seq', greatest(coalesce((select max(id) from public.cms_enquiries),0)+1, (select last_value+case when is_called then 1 else 0 end from public.cms_enquiries_id_seq)), false);
alter table public.cms_enquiries alter column id set default nextval('public.cms_enquiries_id_seq');
alter sequence public.cms_enquiries_id_seq owned by public.cms_enquiries.id;
alter table public.cms_enquiries add column if not exists request_key uuid;
alter table public.cms_enquiries add column if not exists request_fingerprint text;
create unique index if not exists cms_enquiries_request_idx on public.cms_enquiries(request_key);
create index if not exists cms_enquiries_stage_idx on public.cms_enquiries((data->>'status'),created_at desc);
create index if not exists cms_enquiries_owner_idx on public.cms_enquiries((data->>'assignedTo'),created_at desc);
create index if not exists cms_enquiries_service_idx on public.cms_enquiries((data->>'service'),created_at desc);
create index if not exists cms_enquiries_followup_idx on public.cms_enquiries((data->>'followUpAt'));
alter table public.cms_enquiries add column if not exists search_doc tsvector generated always as (to_tsvector('simple', coalesce(data->>'name','') || ' ' || coalesce(data->>'email','') || ' ' || coalesce(data->>'phone','') || ' ' || coalesce(data->>'service','') || ' ' || coalesce(data->>'message','') || ' ' || coalesce(data->>'reference',''))) stored;
create index if not exists cms_enquiries_search_idx on public.cms_enquiries using gin(search_doc);

create table if not exists public.cms_jobs (
 id text primary key, kind text not null default 'email', state text not null default 'pending' check(state in ('pending','processing','sent','failed')),
 payload jsonb not null, context jsonb not null default '{}', attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 claim_token uuid, claimed_at timestamptz, last_error text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists cms_jobs_due_idx on public.cms_jobs(state,next_attempt_at);
create table if not exists public.cms_bookings (
 id uuid primary key, request_key uuid not null unique, token_hash text not null,
 calendar_id text not null, start_at timestamptz not null, end_at timestamptz not null check(end_at > start_at),
 status text not null default 'hold' check(status in ('hold','confirmed','cancelling','cancelled','rescheduled')),
 calendar_event_id text not null, enquiry_id bigint references public.cms_enquiries(id) on delete set null,
 replaces_id uuid references public.cms_bookings(id) on delete set null, data jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 exclude using gist (calendar_id with =, tstzrange(start_at,end_at,'[)') with &&) where (status in ('hold','confirmed','cancelling'))
);
create unique index if not exists cms_bookings_reschedule_idx on public.cms_bookings(replaces_id) where (status='hold');
create index if not exists cms_bookings_date_idx on public.cms_bookings(start_at);
create table if not exists public.cms_operations_events (
 id uuid primary key default gen_random_uuid(), area text not null, code text not null, level text not null default 'error', reference text not null default '', at timestamptz not null default now()
);
create index if not exists cms_operations_at_idx on public.cms_operations_events(at desc);
create table if not exists public.cms_backups (
 id uuid primary key, state text not null default 'pending', data jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.cms_backups add column if not exists lease_token uuid;
alter table public.cms_backups add column if not exists lease_until timestamptz;

create or replace function public.coretax_create_enquiry(p_data jsonb,p_key uuid,p_fingerprint text,p_jobs jsonb default '[]') returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r public.cms_enquiries; j jsonb; new_id bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into r from public.cms_enquiries where request_key=p_key;
 if found then
  if r.request_fingerprint is distinct from p_fingerprint then raise exception 'REQUEST_CONFLICT' using errcode='23505'; end if;
  return jsonb_build_object('enquiry',r.data || jsonb_build_object('id',r.id,'updatedAt',r.updated_at),'duplicate',true);
 end if;
 new_id:=nextval('public.cms_enquiries_id_seq');
 insert into public.cms_enquiries(id,request_key,request_fingerprint,data) values(new_id,p_key,p_fingerprint,p_data || jsonb_build_object('id',new_id,'reference','JMP-'||lpad(new_id::text,6,'0'))) returning * into r;
 for j in select * from jsonb_array_elements(p_jobs) loop
  insert into public.cms_jobs(id,payload,context) values(j->>'key',j->'message',jsonb_build_object('enquiryId',r.id,'reference',r.data->>'reference')) on conflict(id) do nothing;
 end loop;
 return jsonb_build_object('enquiry',r.data || jsonb_build_object('updatedAt',r.updated_at),'duplicate',false);
end $$;

create or replace function public.coretax_update_enquiry(p_id bigint,p_changes jsonb,p_expected timestamptz,p_actor text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r public.cms_enquiries; actions jsonb;
begin
 select * into r from public.cms_enquiries where id=p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
 if p_expected is not null and r.updated_at <> p_expected then raise exception 'STALE_VERSION' using errcode='40001'; end if;
 actions:=jsonb_build_array(jsonb_build_object('at',now(),'by',p_actor,'action','Updated '||(select string_agg(k,', ') from jsonb_object_keys(p_changes) k))) || coalesce(r.data->'activity','[]');
 select coalesce(jsonb_agg(v),'[]') into actions from (select v from jsonb_array_elements(actions) with ordinality a(v,n) order by n limit 100) s;
 update public.cms_enquiries set data=r.data || p_changes || jsonb_build_object('activity',actions,'updatedBy',p_actor),updated_at=clock_timestamp() where id=p_id returning * into r;
 return r.data || jsonb_build_object('id',r.id,'updatedAt',r.updated_at);
end $$;

create or replace function public.coretax_claim_jobs(p_limit integer default 10) returns setof public.cms_jobs
language plpgsql security invoker set search_path=public as $$
begin
 update public.cms_jobs set state='failed',last_error='WORKER_LEASE_EXPIRED',updated_at=now() where state='processing' and attempts>=5 and claimed_at<now()-interval '10 minutes';
 return query update public.cms_jobs set state='processing',attempts=attempts+1,claimed_at=now(),claim_token=gen_random_uuid(),updated_at=now()
 where id in (select id from public.cms_jobs where attempts<5 and ((state='pending' and next_attempt_at<=now()) or (state='processing' and claimed_at<now()-interval '10 minutes')) order by next_attempt_at for update skip locked limit least(greatest(p_limit,1),10)) returning *;
end $$;

create or replace function public.coretax_reserve_booking(p_id uuid,p_token_hash text,p_calendar text,p_start timestamptz,p_end timestamptz,p_event text,p_data jsonb,p_replaces uuid default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r public.cms_bookings; enquiry jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_calendar,1));
 select * into r from public.cms_bookings where request_key=p_id;
 if found then
  if r.start_at<>p_start or r.end_at<>p_end or r.calendar_id<>p_calendar or r.token_hash<>p_token_hash then raise exception 'REQUEST_CONFLICT' using errcode='23505'; end if;
  return to_jsonb(r);
 end if;
 if p_replaces is not null then
  perform 1 from public.cms_bookings where id=p_replaces and status='confirmed' for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
 end if;
 if p_replaces is null then
  enquiry:=public.coretax_create_enquiry(p_data || jsonb_build_object('source','Consultation booking','status','new','bookingId',p_id),p_id,encode(digest(p_data::text,'sha256'),'hex'),'[]');
 else
  select jsonb_build_object('enquiry',jsonb_build_object('id',enquiry_id)) into enquiry from public.cms_bookings where id=p_replaces;
 end if;
 insert into public.cms_bookings(id,request_key,token_hash,calendar_id,start_at,end_at,calendar_event_id,enquiry_id,replaces_id,data)
 values(p_id,p_id,p_token_hash,p_calendar,p_start,p_end,p_event,(enquiry->'enquiry'->>'id')::bigint,p_replaces,p_data) returning * into r;
 return to_jsonb(r);
end $$;

create or replace function public.coretax_confirm_booking(p_id uuid,p_jobs jsonb default '[]') returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r public.cms_bookings; j jsonb;
begin
 select * into r from public.cms_bookings where id=p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
 if r.status='confirmed' then return to_jsonb(r); end if;
 if r.status<>'hold' then raise exception 'BOOKING_CLOSED'; end if;
 if r.replaces_id is not null then update public.cms_bookings set status='rescheduled',updated_at=now() where id=r.replaces_id and status='confirmed'; end if;
 update public.cms_bookings set status='confirmed',updated_at=now() where id=p_id returning * into r;
 update public.cms_enquiries set data=data || jsonb_build_object('status','consultation','bookingId',r.id,'appointmentAt',r.start_at),updated_at=now() where id=r.enquiry_id;
 for j in select * from jsonb_array_elements(p_jobs) loop insert into public.cms_jobs(id,payload,context) values(j->>'key',j->'message',jsonb_build_object('enquiryId',r.enquiry_id,'reference','JMP-'||lpad(r.enquiry_id::text,6,'0'))) on conflict(id) do nothing; end loop;
 return to_jsonb(r);
end $$;

create or replace function public.coretax_start_booking_cancel(p_id uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare r public.cms_bookings;
begin
 select * into r from public.cms_bookings where id=p_id for update;
 if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
 if r.status='cancelled' then return to_jsonb(r); end if;
 if r.status not in ('confirmed','cancelling') or exists(select 1 from public.cms_bookings where replaces_id=p_id and status='hold') then raise exception 'BOOKING_CHANGE_PENDING' using errcode='40001'; end if;
 update public.cms_bookings set status='cancelling',updated_at=now() where id=p_id returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.coretax_start_booking_cancel(uuid) from public,anon,authenticated;
grant execute on function public.coretax_start_booking_cancel(uuid) to service_role;

create or replace function public.coretax_enquiry_search(p_text text) returns tsquery
language sql immutable security invoker set search_path=public as $$
 select to_tsquery('simple',coalesce((select string_agg(quote_literal(term)||':*',' & ') from unnest(tsvector_to_array(to_tsvector('simple',p_text))) t(term)),''));
$$;
revoke all on function public.coretax_enquiry_search(text) from public,anon,authenticated;
grant execute on function public.coretax_enquiry_search(text) to service_role;
create or replace function public.coretax_query_enquiries(p_filter jsonb,p_hours integer default 48,p_now timestamptz default now()) returns jsonb
language sql stable security invoker set search_path=public as $$
 with normalized as not materialized (
  select e.*,case when e.data->>'status'='in-progress' then 'consultation' else coalesce(e.data->>'status','new') end stage,
   case when coalesce(e.data->>'status','new') not in ('closed','client') then
    coalesce(nullif(e.data->>'followUpAt','')::timestamptz,case when coalesce(e.data->>'status','new') in ('new','in-progress','consultation') and coalesce(e.data->>'followUpCompletedAt','')='' then e.created_at+make_interval(hours=>p_hours) end) end due
  from public.cms_enquiries e
 ), filtered as (
  select * from normalized n where
   (coalesce(p_filter->>'status','all')='all' or n.stage=p_filter->>'status')
   and (coalesce(p_filter->>'q','')='' or n.search_doc @@ public.coretax_enquiry_search(p_filter->>'q'))
   and (coalesce(p_filter->>'owner','')='' or n.data->>'assignedTo'=p_filter->>'owner')
   and (coalesce(p_filter->>'service','')='' or n.data->>'service'=p_filter->>'service')
   and (coalesce(p_filter->>'task','all')='all' or
    (p_filter->>'task'='overdue' and n.due<p_now) or
    (p_filter->>'task'='today' and (n.due at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date=(p_now at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date) or
    (p_filter->>'task'='upcoming' and (n.due at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date>(p_now at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date))
 ), paged as (
  select data || jsonb_build_object('id',id,'status',stage,'updatedAt',updated_at) item from filtered order by id desc
  limit least(greatest(coalesce((p_filter->>'pageSize')::integer,25),1),100) offset (greatest(coalesce((p_filter->>'page')::integer,1),1)-1)*least(greatest(coalesce((p_filter->>'pageSize')::integer,25),1),100)
 ), summary as (
  select jsonb_build_object('total',count(*),'stages',jsonb_build_object('new',count(*) filter(where stage='new'),'contacted',count(*) filter(where stage='contacted'),'consultation',count(*) filter(where stage='consultation'),'client',count(*) filter(where stage='client'),'closed',count(*) filter(where stage='closed')),
   'overdue',count(*) filter(where due<p_now),'today',count(*) filter(where (due at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date=(p_now at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date),
   'upcoming',count(*) filter(where (due at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date>(p_now at time zone coalesce(p_filter->>'timeZone','Asia/Kolkata'))::date),
   'owners',coalesce((select jsonb_agg(v) from (select distinct data->>'assignedTo' v from normalized where coalesce(data->>'assignedTo','')<>'' order by v limit 100) x),'[]'),
   'services',coalesce((select jsonb_agg(v) from (select distinct data->>'service' v from normalized where coalesce(data->>'service','')<>'' order by v limit 100) x),'[]')) value from normalized
 ) select jsonb_build_object('enquiries',coalesce((select jsonb_agg(item) from paged),'[]'),'total',(select count(*) from filtered),'page',coalesce((p_filter->>'page')::integer,1),'pageSize',coalesce((p_filter->>'pageSize')::integer,25),'summary',(select value from summary));
$$;
revoke all on function public.coretax_query_enquiries(jsonb,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.coretax_query_enquiries(jsonb,integer,timestamptz) to service_role;

create or replace function public.coretax_backup_snapshot() returns jsonb
language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('schemaVersion',9,'tables',jsonb_build_object(
 'cms_settings',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_settings t),'[]'),
 'cms_menus',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_menus t),'[]'),
 'cms_pages',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_pages t),'[]'),
 'cms_enquiries',coalesce((select jsonb_agg(to_jsonb(t)-'search_doc') from public.cms_enquiries t),'[]'),
 'cms_media',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_media t),'[]'),
 'cms_revisions',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_revisions t),'[]'),
 'cms_profiles',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_profiles t),'[]'),
 'cms_audit_logs',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_audit_logs t),'[]'),
 'cms_visit_events',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_visit_events t),'[]'),
 'cms_integrations',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_integrations t),'[]'),
 'cms_jobs',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_jobs t),'[]'),
 'cms_bookings',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_bookings t),'[]'),
 'cms_operations_events',coalesce((select jsonb_agg(to_jsonb(t)) from public.cms_operations_events t),'[]')));
$$;
create or replace function public.coretax_restore_snapshot(p_snapshot jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare t text; cols text; previous_sequence bigint;
begin
 select last_value+case when is_called then 1 else 0 end into previous_sequence from public.cms_enquiries_id_seq;
 if p_snapshot->>'schemaVersion'<>'9' then raise exception 'INVALID_BACKUP'; end if;
 foreach t in array array['cms_bookings','cms_jobs','cms_revisions','cms_media','cms_enquiries','cms_pages','cms_menus','cms_settings','cms_profiles','cms_audit_logs','cms_visit_events','cms_integrations','cms_operations_events'] loop
  if jsonb_typeof(p_snapshot->'tables'->t) is distinct from 'array' then raise exception 'INCOMPLETE_BACKUP'; end if;
  execute format('delete from public.%I',t);
 end loop;
 foreach t in array array['cms_settings','cms_menus','cms_pages','cms_enquiries','cms_media','cms_revisions','cms_profiles','cms_audit_logs','cms_visit_events','cms_integrations','cms_jobs','cms_bookings','cms_operations_events'] loop
  select string_agg(quote_ident(column_name),',' order by ordinal_position) into cols from information_schema.columns where table_schema='public' and table_name=t and is_generated='NEVER';
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',t,cols,cols,t) using p_snapshot->'tables'->t;
 end loop;
 perform setval('public.cms_enquiries_id_seq',greatest(previous_sequence,coalesce((select max(id) from public.cms_enquiries),0)+1),false);
 -- Queue leases and active sessions are runtime state and must not be revived by a restore.
 update public.cms_jobs set state='failed',last_error='RESTORE_REVIEW_REQUIRED',claim_token=null,claimed_at=null where state in ('pending','processing');
 update public.cms_admin_sessions set revoked=true;
 delete from public.cms_integrations where id='operations_lease';
end $$;
revoke all on function public.coretax_backup_snapshot(),public.coretax_restore_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.coretax_backup_snapshot(),public.coretax_restore_snapshot(jsonb) to service_role;

create or replace function public.coretax_claim_maintenance(p_token uuid) returns boolean
language plpgsql security invoker set search_path=public as $$
declare acquired boolean;
begin
 insert into public.cms_integrations(id,data,updated_at) values('operations_lease',jsonb_build_object('token',p_token,'expiresAt',now()+interval '2 minutes'),now())
 on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at where (cms_integrations.data->>'expiresAt')::timestamptz<now()
 returning true into acquired;
 return coalesce(acquired,false);
end $$;
revoke all on function public.coretax_claim_maintenance(uuid) from public,anon,authenticated;
grant execute on function public.coretax_claim_maintenance(uuid) to service_role;

do $$ declare t text; begin
 foreach t in array array['cms_jobs','cms_bookings','cms_operations_events','cms_backups'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.coretax_create_enquiry(jsonb,uuid,text,jsonb),public.coretax_update_enquiry(bigint,jsonb,timestamptz,text),public.coretax_claim_jobs(integer),public.coretax_reserve_booking(uuid,text,text,timestamptz,timestamptz,text,jsonb,uuid),public.coretax_confirm_booking(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.coretax_create_enquiry(jsonb,uuid,text,jsonb),public.coretax_update_enquiry(bigint,jsonb,timestamptz,text),public.coretax_claim_jobs(integer),public.coretax_reserve_booking(uuid,text,text,timestamptz,timestamptz,text,jsonb,uuid),public.coretax_confirm_booking(uuid,jsonb) to service_role;
grant usage,select on sequence public.cms_enquiries_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cms-backups','cms-backups',false,52428800,null) on conflict(id) do update set public=false;
-- Explicit service-only access for all application data; browser reads stay behind authenticated API routes.
grant all on public.cms_settings,public.cms_menus,public.cms_pages,public.cms_enquiries,public.cms_media,public.cms_revisions,public.cms_profiles,public.cms_admin_sessions,public.cms_audit_logs,public.cms_rate_limits,public.cms_totp_uses to service_role;
revoke all on function public.coretax_consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.coretax_consume_rate_limit(text,integer,integer) to service_role;
-- Recognised legacy labels and placeholder homepage copy only; custom content remains intact.
update public.cms_menus set data=jsonb_set(jsonb_set(data,'{header}',coalesce((select jsonb_agg(case when item->>'label'='Other Services' and item->>'url'='/other-services' then jsonb_set(item,'{label}','"CoreTax Services"') else item end order by n) from jsonb_array_elements(data->'header') with ordinality a(item,n)),'[]')),'{footer}',coalesce((select jsonb_agg(case when item->>'label'='Other Services' and item->>'url'='/other-services' then jsonb_set(item,'{label}','"CoreTax Services"') else item end order by n) from jsonb_array_elements(data->'footer') with ordinality a(item,n)),'[]'));
update public.cms_pages set data=jsonb_set(jsonb_set(data,'{heroTitle}','"Accounting, tax and compliance. A clear next step."'),'{heroText}','"Chartered accountants in Vadodara, supporting individuals and businesses with accounting, taxation, audit and compliance. Find the service you need or speak with our team."'),updated_at=now() where slug='home' and data->>'heroTitle'='Reliable financial clarity for growing businesses.';
update public.cms_pages set data=replace(data::text,'Book a Consultation','Request a Consultation')::jsonb where data::text like '%Book a Consultation%';
commit;
