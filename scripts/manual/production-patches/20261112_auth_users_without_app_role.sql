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
-- @rollback: restore only the deleted auth.users and auth.identities rows from the pre-apply critical Production backup (the dry-run query run against the backup lists their ids), in one transaction that sets their encrypted_password to an unusable empty value instead of the dump's placeholder password and bans them until the owner sends a password reset; the backup holds no real password hashes or sessions. Public and Storage rows that referenced the accounts were checked to be absent before the delete, so nothing else needs restoring

begin;

-- Deleting an account cascades to rows it owns, nulls or blocks on rows that reference it, and
-- leaves Storage objects pointing at a missing owner. Stop unless nothing references the accounts.
-- The patch builds no SQL at run time: it checks a fixed list of the public foreign keys to
-- auth.users and first asserts that the catalog holds exactly that list, so a retired or new
-- reference stops the patch instead of going unchecked. Every table the checks read is
-- share-locked until commit; the share lock on auth.users also blocks a new foreign key to it,
-- so no account, role, reference or Storage object can appear between the checks and the delete.
do $$
declare
  targets integer;
  listed integer;
  unlisted integer;
begin
  lock table
    auth.users,
    public.app_user_roles,
    storage.objects,
    public.audit_logs,
    public.commercial_demo_followups,
    public.event_memberships,
    public.event_memory_settings,
    public.events,
    public.invitation_access_controls,
    public.invitations
  in share mode;

  select count(*) into listed
  from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f'
    and c.confrelid = 'auth.users'::regclass
    and c.connamespace = 'public'::regnamespace
    and (cl.relname::text, a.attname::text) in (values
      ('app_user_roles', 'user_id'),
      ('events', 'owner_user_id'),
      ('event_memberships', 'user_id'),
      ('audit_logs', 'actor_id'),
      ('invitations', 'created_by'),
      ('invitations', 'owner_reviewed_by'),
      ('commercial_demo_followups', 'created_by'),
      ('event_memory_settings', 'created_by'),
      ('invitation_access_controls', 'updated_by'));
  select count(*) into unlisted
  from pg_constraint c
  join pg_class cl on cl.oid = c.conrelid
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f'
    and c.confrelid = 'auth.users'::regclass
    and c.connamespace = 'public'::regnamespace
    and (cl.relname::text, a.attname::text) not in (values
      ('app_user_roles', 'user_id'),
      ('events', 'owner_user_id'),
      ('event_memberships', 'user_id'),
      ('audit_logs', 'actor_id'),
      ('invitations', 'created_by'),
      ('invitations', 'owner_reviewed_by'),
      ('commercial_demo_followups', 'created_by'),
      ('event_memory_settings', 'created_by'),
      ('invitation_access_controls', 'updated_by'));
  if listed <> 9 or unlisted <> 0 then
    raise exception 'The public foreign keys to auth.users changed: % listed, % unlisted; review the patch before deleting.', listed, unlisted;
  end if;

  select count(*) into targets
  from auth.users u
  where not exists (select 1 from public.app_user_roles r where r.user_id = u.id);
  if targets <> 2 then
    raise exception 'Expected the 2 reviewed Auth accounts without an app role, found %.', targets;
  end if;

  if exists (
    select 1
    from auth.users x
    where not exists (select 1 from public.app_user_roles r where r.user_id = x.id)
      and (
      exists (select 1 from public.events t where t.owner_user_id = x.id)
      or exists (select 1 from public.event_memberships t where t.user_id = x.id)
      or exists (select 1 from public.audit_logs t where t.actor_id = x.id)
      or exists (select 1 from public.invitations t where t.created_by = x.id)
      or exists (select 1 from public.invitations t where t.owner_reviewed_by = x.id)
      or exists (select 1 from public.commercial_demo_followups t where t.created_by = x.id)
      or exists (select 1 from public.event_memory_settings t where t.created_by = x.id)
      or exists (select 1 from public.invitation_access_controls t where t.updated_by = x.id)
      )
  ) then
    raise exception 'An Auth account without an app role is still referenced by a public table; review it before deleting.';
  end if;

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
