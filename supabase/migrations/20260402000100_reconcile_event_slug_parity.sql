begin;

create temp table tmp_event_slug_reconcile (
  event_type text not null,
  source_slug text not null,
  target_slug text not null,
  target_title text not null
) on commit drop;

insert into tmp_event_slug_reconcile (event_type, source_slug, target_slug, target_title)
values
  ('cumple', 'demo-gerardo-sesenta', 'gerardo-sesenta', 'Gerardo Mendoza | 60 Años'),
  ('xv', 'demo-xv', 'ximena-meza-trasvina', 'La Noche Premiere de Ximena');

insert into public.events (
  owner_user_id,
  slug,
  event_type,
  title,
  status,
  published_at,
  created_at,
  updated_at
)
select
  source_event.owner_user_id,
  pair.target_slug,
  pair.event_type,
  pair.target_title,
  source_event.status,
  source_event.published_at,
  source_event.created_at,
  now()
from tmp_event_slug_reconcile pair
join public.events source_event
  on source_event.slug = pair.source_slug
 and source_event.event_type = pair.event_type
left join public.events target_event
  on target_event.slug = pair.target_slug
 and target_event.event_type = pair.event_type
where target_event.id is null;

do $$
declare
  missing_targets text;
begin
  select string_agg(format('%s/%s', pair.event_type, pair.target_slug), ', ')
  into missing_targets
  from tmp_event_slug_reconcile pair
  left join public.events source_event
    on source_event.slug = pair.source_slug
   and source_event.event_type = pair.event_type
  left join public.events target_event
    on target_event.slug = pair.target_slug
   and target_event.event_type = pair.event_type
  where source_event.id is null
    and target_event.id is null;

  if missing_targets is not null then
    raise exception
      'Cannot reconcile event parity because these canonical events are missing and there is no demo source to clone: %',
      missing_targets;
  end if;
end
$$;

update public.events target_event
set title = pair.target_title,
    updated_at = now()
from tmp_event_slug_reconcile pair
where target_event.slug = pair.target_slug
  and target_event.event_type = pair.event_type
  and target_event.title is distinct from pair.target_title;

insert into public.event_memberships (
  event_id,
  user_id,
  membership_role,
  created_at,
  updated_at
)
select
  target_event.id,
  source_membership.user_id,
  source_membership.membership_role,
  source_membership.created_at,
  now()
from tmp_event_slug_reconcile pair
join public.events source_event
  on source_event.slug = pair.source_slug
 and source_event.event_type = pair.event_type
join public.events target_event
  on target_event.slug = pair.target_slug
 and target_event.event_type = pair.event_type
join public.event_memberships source_membership
  on source_membership.event_id = source_event.id
left join public.event_memberships target_membership
  on target_membership.event_id = target_event.id
 and target_membership.user_id = source_membership.user_id
where target_membership.id is null;

update public.event_claim_codes claim_code
set event_id = target_event.id,
    updated_at = now()
from tmp_event_slug_reconcile pair
join public.events source_event
  on source_event.slug = pair.source_slug
 and source_event.event_type = pair.event_type
join public.events target_event
  on target_event.slug = pair.target_slug
 and target_event.event_type = pair.event_type
where claim_code.event_id = source_event.id
  and claim_code.event_id <> target_event.id;

create temp table tmp_guest_conflicts on commit drop as
select
  source_guest.id as source_guest_id,
  target_guest.id as target_guest_id,
  pair.source_slug
from tmp_event_slug_reconcile pair
join public.events source_event
  on source_event.slug = pair.source_slug
 and source_event.event_type = pair.event_type
join public.events target_event
  on target_event.slug = pair.target_slug
 and target_event.event_type = pair.event_type
join public.guest_invitations source_guest
  on source_guest.event_id = source_event.id
join public.guest_invitations target_guest
  on target_guest.event_id = target_event.id
 and target_guest.phone = source_guest.phone;

update public.guest_invitation_audit audit_row
set guest_invitation_id = conflict.target_guest_id
from tmp_guest_conflicts conflict
where audit_row.guest_invitation_id = conflict.source_guest_id;

update public.guest_invitations target_guest
set full_name = case
      when btrim(coalesce(target_guest.full_name, '')) = '' then source_guest.full_name
      else target_guest.full_name
    end,
    max_allowed_attendees = greatest(target_guest.max_allowed_attendees, source_guest.max_allowed_attendees),
    attendance_status = case
      when target_guest.attendance_status = 'confirmed' or source_guest.attendance_status = 'confirmed' then 'confirmed'
      when target_guest.attendance_status = 'pending' or source_guest.attendance_status = 'pending' then 'pending'
      else 'declined'
    end,
    attendee_count = greatest(
      target_guest.attendee_count,
      source_guest.attendee_count,
      case
        when target_guest.attendance_status = 'confirmed' or source_guest.attendance_status = 'confirmed' then 1
        else 0
      end
    ),
    guest_message = case
      when btrim(coalesce(target_guest.guest_message, '')) = '' then source_guest.guest_message
      else target_guest.guest_message
    end,
    delivery_status = case
      when target_guest.delivery_status = 'shared' or source_guest.delivery_status = 'shared' then 'shared'
      else target_guest.delivery_status
    end,
    first_viewed_at = case
      when target_guest.first_viewed_at is null then source_guest.first_viewed_at
      when source_guest.first_viewed_at is null then target_guest.first_viewed_at
      else least(target_guest.first_viewed_at, source_guest.first_viewed_at)
    end,
    last_viewed_at = case
      when target_guest.last_viewed_at is null then source_guest.last_viewed_at
      when source_guest.last_viewed_at is null then target_guest.last_viewed_at
      else greatest(target_guest.last_viewed_at, source_guest.last_viewed_at)
    end,
    responded_at = case
      when target_guest.responded_at is null then source_guest.responded_at
      when source_guest.responded_at is null then target_guest.responded_at
      else greatest(target_guest.responded_at, source_guest.responded_at)
    end,
    legacy_guest_id = coalesce(target_guest.legacy_guest_id, source_guest.legacy_guest_id),
    legacy_event_slug = coalesce(target_guest.legacy_event_slug, source_guest.legacy_event_slug, conflict.source_slug),
    updated_at = now()
from tmp_guest_conflicts conflict
join public.guest_invitations source_guest
  on source_guest.id = conflict.source_guest_id
where target_guest.id = conflict.target_guest_id;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_invitations'
      and column_name = 'email'
  ) then
    execute $sql$
      update public.guest_invitations target_guest
      set email = coalesce(target_guest.email, source_guest.email)
      from tmp_guest_conflicts conflict
      join public.guest_invitations source_guest
        on source_guest.id = conflict.source_guest_id
      where target_guest.id = conflict.target_guest_id
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_invitations'
      and column_name = 'tags'
  ) then
    execute $sql$
      update public.guest_invitations target_guest
      set tags = array(
        select distinct tag
        from unnest(coalesce(target_guest.tags, '{}'::text[]) || coalesce(source_guest.tags, '{}'::text[])) as tag
      )
      from tmp_guest_conflicts conflict
      join public.guest_invitations source_guest
        on source_guest.id = conflict.source_guest_id
      where target_guest.id = conflict.target_guest_id
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_invitations'
      and column_name = 'metadata'
  ) then
    execute $sql$
      update public.guest_invitations target_guest
      set metadata = coalesce(target_guest.metadata, '{}'::jsonb) || coalesce(source_guest.metadata, '{}'::jsonb)
      from tmp_guest_conflicts conflict
      join public.guest_invitations source_guest
        on source_guest.id = conflict.source_guest_id
      where target_guest.id = conflict.target_guest_id
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_invitations'
      and column_name = 'entry_source'
  ) then
    execute $sql$
      update public.guest_invitations target_guest
      set entry_source = case
        when target_guest.entry_source = 'generic_public' or source_guest.entry_source = 'generic_public' then 'generic_public'
        else target_guest.entry_source
      end
      from tmp_guest_conflicts conflict
      join public.guest_invitations source_guest
        on source_guest.id = conflict.source_guest_id
      where target_guest.id = conflict.target_guest_id
    $sql$;
  end if;
end
$$;

delete from public.guest_invitations source_guest
using tmp_guest_conflicts conflict
where source_guest.id = conflict.source_guest_id;

update public.guest_invitations guest
set event_id = target_event.id,
    legacy_event_slug = coalesce(guest.legacy_event_slug, pair.source_slug),
    updated_at = now()
from tmp_event_slug_reconcile pair
join public.events source_event
  on source_event.slug = pair.source_slug
 and source_event.event_type = pair.event_type
join public.events target_event
  on target_event.slug = pair.target_slug
 and target_event.event_type = pair.event_type
where guest.event_id = source_event.id
  and not exists (
    select 1
    from tmp_guest_conflicts conflict
    where conflict.source_guest_id = guest.id
  );

delete from public.events source_event
using tmp_event_slug_reconcile pair
where source_event.slug = pair.source_slug
  and source_event.event_type = pair.event_type;

commit;
