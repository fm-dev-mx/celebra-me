-- @script-id: 20261109_auth_login_alias_app_metadata_backfill
-- @purpose: Copy each host login alias from user-editable Auth user metadata into protected app metadata, so alias login works again for the accounts created before aliases were protected
-- @env: production
-- @ticket: Production incident 2026-11-09, hosts get 401 on alias login after fm-dev-mx/celebra-me#866; pnpm auth:migrate-login-alias --dry-run reported planned 28, duplicates 0
-- @tables: auth.users
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 28
-- @requires-backup: true
-- @dry-run-query: select id from auth.users where nullif(btrim(coalesce(raw_app_meta_data->>'login_alias', ''), E' \t\n\r'), '') is null and nullif(btrim(coalesce(raw_user_meta_data->>'login_alias', ''), E' \t\n\r'), '') is not null
-- @rollback: update auth.users set raw_app_meta_data = raw_app_meta_data - 'login_alias' where id in (the ids listed by the reviewed plan); this turns alias login off again for those accounts, and the critical backup keeps the previous raw_app_meta_data of every user

begin;

-- Legacy aliases were user-writable, so two accounts may claim the same one. Stop before writing.
do $$
begin
  if exists (
    select 1
    from auth.users
    where coalesce(
      nullif(lower(btrim(coalesce(raw_app_meta_data->>'login_alias', ''), E' \t\n\r')), ''),
      nullif(lower(btrim(coalesce(raw_user_meta_data->>'login_alias', ''), E' \t\n\r')), '')
    ) is not null
    group by coalesce(
      nullif(lower(btrim(coalesce(raw_app_meta_data->>'login_alias', ''), E' \t\n\r')), ''),
      nullif(lower(btrim(coalesce(raw_user_meta_data->>'login_alias', ''), E' \t\n\r')), '')
    )
    having count(*) > 1
  ) then
    raise exception 'LOGIN_ALIAS_DUPLICATE: resolve the duplicate aliases before the backfill';
  end if;
end $$;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'login_alias',
    lower(btrim(raw_user_meta_data->>'login_alias', E' \t\n\r'))
  )
where nullif(btrim(coalesce(raw_app_meta_data->>'login_alias', ''), E' \t\n\r'), '') is null
  and nullif(btrim(coalesce(raw_user_meta_data->>'login_alias', ''), E' \t\n\r'), '') is not null;

commit;
