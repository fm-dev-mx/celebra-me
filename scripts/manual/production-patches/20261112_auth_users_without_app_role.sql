-- @script-id: 20261112_auth_users_without_app_role
-- @purpose: Delete the two Production Auth accounts that have no app_user_roles row (a dormant admin account and a leftover verification test account), as the owner decided, so every remaining account carries a valid application role
-- @env: production
-- @ticket: Data prerequisite auth-role-app-metadata reported accounts=34, matching=32, differing=2, orphanRoles=0 on 2026-11-12; both differing accounts lack an app_user_roles row, own no events or memberships, and last signed in on 2026-06-02
-- @tables: auth.users
-- @operation: delete
-- @expected-rows-min: 2
-- @expected-rows-max: 2
-- @requires-backup: true
-- @dry-run-query: select u.id from auth.users u where not exists (select 1 from public.app_user_roles r where r.user_id = u.id)
-- @rollback: restore the deleted auth.users and auth.identities rows from the pre-apply critical Production backup (the dry-run query run against the backup lists their ids); that backup holds no password hashes or sessions, so a restored account signs in again only after a password reset. Public and Storage rows that referenced the accounts were checked to be absent before the delete, so nothing else needs restoring

begin;

-- Deleting an account cascades to rows it owns, nulls or blocks on rows that reference it, and
-- leaves Storage objects pointing at a missing owner. Stop unless nothing references the accounts.
-- The foreign keys are read from the catalog so a retired or new table cannot go unchecked.
-- Every table the checks read is share-locked until commit, so no account, role, reference or
-- Storage object can appear between the checks and the delete.
do $$
declare
  fk record;
  referenced boolean;
  targets integer;
begin
  lock table auth.users, public.app_user_roles, storage.objects in share mode;
  for fk in
    select distinct c.conrelid::regclass as tbl
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.connamespace = 'public'::regnamespace
  loop
    execute format('lock table %s in share mode', fk.tbl);
  end loop;

  select count(*) into targets
  from auth.users u
  where not exists (select 1 from public.app_user_roles r where r.user_id = u.id);
  if targets <> 2 then
    raise exception 'Expected the 2 reviewed Auth accounts without an app role, found %.', targets;
  end if;

  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.connamespace = 'public'::regnamespace
      and c.conrelid <> 'public.app_user_roles'::regclass
  loop
    execute format(
      'select exists (select 1 from %s t join auth.users u on u.id = t.%I where not exists (select 1 from public.app_user_roles r where r.user_id = u.id))',
      fk.tbl, fk.col
    ) into referenced;
    if referenced then
      raise exception 'An Auth account without an app role is still referenced by %.%; review it before deleting.', fk.tbl, fk.col;
    end if;
  end loop;

  if exists (
    select 1
    from storage.objects o
    join auth.users u on u.id = o.owner or o.owner_id = u.id::text
    where not exists (select 1 from public.app_user_roles r where r.user_id = u.id)
  ) then
    raise exception 'An Auth account without an app role still owns Storage objects; review them before deleting.';
  end if;
end;
$$;

delete from auth.users u
where not exists (select 1 from public.app_user_roles r where r.user_id = u.id);

commit;
