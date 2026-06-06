begin;

create temp table local_admin_bootstrap (
  email text not null,
  password text not null,
  user_id uuid not null
) on commit drop;

insert into local_admin_bootstrap (email, password, user_id)
select
  __ADMIN_EMAIL__,
  __ADMIN_PASSWORD__,
  (
    substr(md5(__ADMIN_EMAIL__), 1, 8) || '-' ||
    substr(md5(__ADMIN_EMAIL__), 9, 4) || '-' ||
    substr(md5(__ADMIN_EMAIL__), 13, 4) || '-' ||
    substr(md5(__ADMIN_EMAIL__), 17, 4) || '-' ||
    substr(md5(__ADMIN_EMAIL__), 21, 12)
  )::uuid;

update local_admin_bootstrap b
set user_id = u.id
from auth.users u
where lower(u.email) = b.email;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
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
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', ''
from local_admin_bootstrap b
where not exists (
  select 1 from auth.users u where lower(u.email) = b.email
)
on conflict (id) do nothing;

update auth.users u
set email = b.email,
    encrypted_password = crypt(b.password, gen_salt('bf')),
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) ||
      '{"provider":"email","providers":["email"],"role":"super_admin"}'::jsonb,
    updated_at = now(),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = ''
from local_admin_bootstrap b
where u.id = b.user_id;

insert into public.app_user_roles (user_id, role)
select user_id, 'super_admin'
from local_admin_bootstrap
on conflict (user_id) do update set role = 'super_admin', updated_at = now();

commit;
