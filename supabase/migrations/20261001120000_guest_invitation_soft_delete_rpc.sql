-- Server-side soft delete for dashboard guests.
--
-- Client sessions cannot soft-delete guests through RLS: an UPDATE whose WHERE
-- clause reads the table must leave a row that still satisfies the SELECT
-- policy, and guest_invitations only exposes active rows (deleted_at is null).
-- Every dashboard soft delete was therefore rejected with 42501.
--
-- Following the guest write model (privileged guest writes run behind the BFF
-- through service-role-only RPCs), this function soft-deletes one active guest
-- after re-checking, inside the database, that the actor owns the event, is an
-- active member of it, or is a super admin. Table grants and RLS policies are
-- unchanged, so soft-deleted guests stay invisible to client sessions.

begin;

create function public.soft_delete_guest_invitation_v1(
  p_guest_id uuid,
  p_actor_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_event_id uuid;
begin
  if p_guest_id is null or p_actor_user_id is null then
    raise exception using errcode = 'P0001', message = 'guest_invitation_not_found';
  end if;

  select gi.event_id
    into v_event_id
    from public.guest_invitations gi
   where gi.id = p_guest_id
     and gi.deleted_at is null
   for update;

  if not found then
    return false;
  end if;

  if not exists (
    select 1
      from public.events e
     where e.id = v_event_id
       and e.deleted_at is null
       and (
         e.owner_user_id = p_actor_user_id
         or exists (
           select 1 from public.event_memberships em
            where em.event_id = e.id
              and em.user_id = p_actor_user_id
              and em.deleted_at is null
         )
         or exists (
           select 1 from public.app_user_roles aur
            where aur.user_id = p_actor_user_id
              and aur.role = 'super_admin'
         )
       )
  ) then
    raise exception using errcode = '42501', message = 'guest_invitation_access_denied';
  end if;

  update public.guest_invitations
     set deleted_at = pg_catalog.now()
   where id = p_guest_id
     and deleted_at is null;

  return true;
end;
$function$;

revoke all on function public.soft_delete_guest_invitation_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_guest_invitation_v1(uuid, uuid) to service_role;

commit;

notify pgrst, 'reload schema';
