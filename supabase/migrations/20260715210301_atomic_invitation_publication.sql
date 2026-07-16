begin;

create or replace function public.publish_invitation_atomic(
  p_invitation_id uuid,
  p_draft_id uuid,
  p_expected_draft_updated_at timestamptz,
  p_slug text,
  p_event_type text,
  p_is_demo boolean,
  p_content jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_invitation public.invitations%rowtype;
  v_draft public.invitation_content_drafts%rowtype;
  v_published public.published_invitation_content%rowtype;
  v_linked_event public.events%rowtype;
  v_slug_event public.events%rowtype;
begin
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id and archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'publish_invitation_not_found';
  end if;

  if v_invitation.event_type <> p_event_type then
    raise exception using errcode = 'P0001', message = 'publish_event_type_mismatch';
  end if;

  select * into v_draft
  from public.invitation_content_drafts
  where id = p_draft_id
    and invitation_project_id = p_invitation_id
    and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'publish_draft_not_found';
  end if;

  if v_draft.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'publish_invalid_draft_status';
  end if;

  if v_draft.updated_at <> p_expected_draft_updated_at then
    raise exception using errcode = 'P0001', message = 'publish_stale_draft';
  end if;

  if exists (
    select 1
    from public.published_invitation_content
    where slug = p_slug
      and event_type = p_event_type
      and invitation_project_id is distinct from p_invitation_id
      and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'publish_slug_conflict';
  end if;

  if not p_is_demo then
    if v_invitation.created_by is null then
      raise exception using errcode = 'P0001', message = 'publish_owner_required';
    end if;

    select * into v_linked_event
    from public.events
    where invitation_project_id = p_invitation_id and deleted_at is null
    for update;

    select * into v_slug_event
    from public.events
    where slug = p_slug and deleted_at is null
    for update;

    if v_linked_event.id is not null
      and v_slug_event.id is not null
      and v_linked_event.id <> v_slug_event.id then
      raise exception using errcode = 'P0001', message = 'publish_event_slug_conflict';
    end if;

    if coalesce(v_linked_event.event_type, v_slug_event.event_type) is not null
      and coalesce(v_linked_event.event_type, v_slug_event.event_type) <> p_event_type then
      raise exception using errcode = 'P0001', message = 'publish_event_type_conflict';
    end if;

    if coalesce(v_linked_event.id, v_slug_event.id) is not null then
      update public.events
      set title = v_invitation.title,
          slug = p_slug,
          status = 'published',
          published_at = now(),
          invitation_project_id = p_invitation_id
      where id = coalesce(v_linked_event.id, v_slug_event.id);
    else
      insert into public.events (
        owner_user_id, slug, event_type, title, status, published_at, invitation_project_id
      ) values (
        v_invitation.created_by, p_slug, p_event_type, v_invitation.title,
        'published', now(), p_invitation_id
      );
    end if;
  end if;

  select * into v_published
  from public.published_invitation_content
  where invitation_project_id = p_invitation_id and deleted_at is null
  order by created_at desc
  limit 1
  for update;

  if v_published.id is null then
    insert into public.published_invitation_content (
      invitation_project_id, slug, event_type, is_demo, content, version, published_at
    ) values (
      p_invitation_id, p_slug, p_event_type, p_is_demo, p_content, 1, now()
    ) returning * into v_published;
  else
    update public.published_invitation_content
    set slug = p_slug,
        event_type = p_event_type,
        is_demo = p_is_demo,
        content = p_content,
        version = v_published.version + 1,
        published_at = now()
    where id = v_published.id
    returning * into v_published;
  end if;

  update public.invitations
  set status = 'published'
  where id = p_invitation_id;

  update public.invitation_content_drafts
  set status = 'approved'
  where id = p_draft_id
  returning * into v_draft;

  return jsonb_build_object(
    'draft', jsonb_build_object(
      'id', v_draft.id,
      'invitationId', v_draft.invitation_project_id,
      'submissionId', v_draft.submission_id,
      'content', v_draft.content,
      'status', v_draft.status,
      'createdAt', v_draft.created_at,
      'updatedAt', v_draft.updated_at
    ),
    'publishedContent', jsonb_build_object(
      'id', v_published.id,
      'slug', v_published.slug,
      'eventType', v_published.event_type,
      'version', v_published.version,
      'publishedAt', v_published.published_at
    )
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'publish_slug_conflict';
end;
$function$;

revoke all on function public.publish_invitation_atomic(uuid, uuid, timestamptz, text, text, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.publish_invitation_atomic(uuid, uuid, timestamptz, text, text, boolean, jsonb)
  to service_role;

comment on function public.publish_invitation_atomic(uuid, uuid, timestamptz, text, text, boolean, jsonb) is
  'Atomically synchronizes RSVP state, public content, invitation status, and draft status with stale-write protection.';

commit;
