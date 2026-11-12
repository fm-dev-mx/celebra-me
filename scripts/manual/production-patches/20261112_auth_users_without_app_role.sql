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
-- @rollback: restore the deleted auth.users rows and their cascaded auth.identities and auth.sessions rows from the pre-apply Production backup (the dry-run query run against the backup lists their ids); public rows that referenced them were checked to be absent before the delete

begin;

-- Deleting an account cascades to rows it owns or blocks on rows that reference it.
-- Stop unless the accounts are referenced nowhere in public data.
do $$
begin
  if exists (
    select 1
    from auth.users u
    where not exists (select 1 from public.app_user_roles r where r.user_id = u.id)
      and (
        exists (select 1 from public.events e where e.owner_user_id = u.id)
        or exists (select 1 from public.event_memberships m where m.user_id = u.id)
        or exists (select 1 from public.audit_logs a where a.actor_id = u.id)
        or exists (select 1 from public.invitation_projects p where p.created_by = u.id)
        or exists (select 1 from public.invitations i where i.owner_reviewed_by = u.id)
        or exists (select 1 from public.commercial_demo_followups f where f.created_by = u.id)
        or exists (select 1 from public.event_memory_settings s where s.created_by = u.id)
        or exists (select 1 from public.invitation_access_controls c where c.updated_by = u.id)
      )
  ) then
    raise exception 'An Auth account without an app role is still referenced by public data; review it before deleting.';
  end if;
end;
$$;

delete from auth.users u
where not exists (select 1 from public.app_user_roles r where r.user_id = u.id);

commit;
