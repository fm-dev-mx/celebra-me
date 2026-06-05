begin;

create temp table refresh_auth_ids (user_id uuid primary key);

insert into refresh_auth_ids(user_id)
select distinct user_id from __STAGING_SCHEMA__.host_profiles where user_id is not null
on conflict do nothing;
insert into refresh_auth_ids(user_id)
select distinct owner_user_id from __STAGING_SCHEMA__.events where owner_user_id is not null
on conflict do nothing;
insert into refresh_auth_ids(user_id)
select distinct user_id from __STAGING_SCHEMA__.app_user_roles where user_id is not null
on conflict do nothing;
insert into refresh_auth_ids(user_id)
select distinct user_id from __STAGING_SCHEMA__.event_memberships where user_id is not null
on conflict do nothing;
insert into refresh_auth_ids(user_id)
select distinct created_by from __STAGING_SCHEMA__.event_claim_codes where created_by is not null
on conflict do nothing;
insert into refresh_auth_ids(user_id)
select distinct actor_id from __STAGING_SCHEMA__.audit_logs where actor_id is not null
on conflict do nothing;
insert into refresh_auth_ids(user_id)
select distinct created_by from __STAGING_SCHEMA__.invitations where created_by is not null
on conflict do nothing;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  user_id,
  'authenticated',
  'authenticated',
  'prod-user-' || replace(user_id::text, '-', '') || '@celebra-me.local',
  crypt('local-refresh-user-only', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from refresh_auth_ids
on conflict (id) do nothing;

with local_admin as (
  select
    lower(split_part(current_setting('app.local_super_admin_emails', true), ',', 1)) as email,
    current_setting('app.local_super_admin_password', true) as password,
    current_setting('app.local_admin_alias', true) as alias
),
local_admin_id as (
  select (
    substr(md5(email), 1, 8) || '-' ||
    substr(md5(email), 9, 4) || '-' ||
    substr(md5(email), 13, 4) || '-' ||
    substr(md5(email), 17, 4) || '-' ||
    substr(md5(email), 21, 12)
  )::uuid as user_id, email, password, alias
  from local_admin
  where email <> '' and password <> ''
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  user_id,
  'authenticated',
  'authenticated',
  email,
  crypt(password, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"super_admin"}'::jsonb,
  case when alias <> '' then jsonb_build_object('login_alias', alias) else '{}'::jsonb end,
  now(),
  now(),
  '',
  '',
  '',
  ''
from local_admin_id
on conflict (id) do update
set email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

do $$
declare
  table_record record;
  table_list text;
  column_list text;
begin
  -- Truncate all public tables (CASCADE handles FK order for deletion).
  select string_agg(format('public.%I', tablename), ', ')
  into table_list
  from pg_tables
  where schemaname = 'public';

  if table_list is not null then
    execute 'truncate table ' || table_list || ' cascade';
  end if;

  -- Explicit FK-safe copy order: parents before children.
  -- Tables are only copied when they exist in BOTH public and the staging schema.
  -- Tables that exist only locally (e.g. from a migration not yet in production)
  -- are truncated but NOT re-populated; they remain empty after refresh.
  -- See tests for the official ordering requirements.
  create temp table copy_order (pos int primary key, tablename text);
  insert into copy_order values
    (1,  'app_user_roles'),
    (2,  'audit_logs'),
    (3,  'host_profiles'),
    (4,  'invitations'),
    (5,  'rsvp_records'),
    (6,  'events'),
    (7,  'intake_requests'),
    (8,  'published_invitation_content'),
    (9,  'guest_invitations'),
    (10, 'event_memberships'),
    (11, 'event_claim_codes'),
    (12, 'invitation_assets'),
    (13, 'intake_submissions'),
    (14, 'guest_invitation_audit'),
    (15, 'rsvp_audit_log'),
    (16, 'rsvp_channel_log'),
    (17, 'invitation_content_drafts');

  for table_record in
    select p.tablename
    from copy_order o
    inner join pg_tables p
      on p.tablename = o.tablename
     and p.schemaname = 'public'
    inner join pg_tables s
      on s.tablename = o.tablename
     and s.schemaname = '__STAGING_SCHEMA__'
    order by o.pos
  loop
    select string_agg(format('%I', p.column_name), ', ' order by p.ordinal_position)
    into column_list
    from information_schema.columns p
    join information_schema.columns s
      on s.table_schema = '__STAGING_SCHEMA__'
     and s.table_name = p.table_name
     and s.column_name = p.column_name
    where p.table_schema = 'public'
      and p.table_name = table_record.tablename
      and p.is_generated = 'NEVER';

    raise notice 'Copying table: %', table_record.tablename;

    if column_list is not null then
      execute format(
        'insert into public.%I (%s) select %s from __STAGING_SCHEMA__.%I',
        table_record.tablename,
        column_list,
        column_list,
        table_record.tablename
      );
    end if;
  end loop;

  drop table copy_order;
end $$;

insert into public.app_user_roles (user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = lower(split_part(current_setting('app.local_super_admin_emails', true), ',', 1))
on conflict (user_id) do update set role = 'super_admin', updated_at = now();

insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit)
values ('invitation-assets', 'invitation-assets', true, false, __STORAGE_BUCKET_SIZE_LIMIT__)
on conflict (id) do nothing;

commit;
