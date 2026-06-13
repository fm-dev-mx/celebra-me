begin;

do $$
declare
  v_matching_count int;
begin
  if not exists (
    select 1
    from public.events
    where id = '4a1adaa9-b621-4164-906a-7c02fbf52772'
      and slug = 'ayrin-samantha-lerma-castro'
      and event_type = 'xv'
  ) then
    raise exception 'GUARD_FAILED: event not found or slug/type mismatch';
  end if;

  select count(*)
  into v_matching_count
  from public.guest_invitations
  where event_id = '4a1adaa9-b621-4164-906a-7c02fbf52772'
    and delivery_status = 'generated'
    and deleted_at is null
    and is_viewed = true;

  if v_matching_count = 0 then
    raise exception 'GUARD_FAILED: no viewed generated guests found to repair';
  end if;

  if v_matching_count > 5 then
    raise exception 'GUARD_FAILED: expected a small repair set, found % rows',
      v_matching_count;
  end if;
end $$;

with updated as (
  update public.guest_invitations
  set
    delivery_status = 'shared',
    first_shared_at = coalesce(first_shared_at, now()),
    updated_at = now()
  where event_id = '4a1adaa9-b621-4164-906a-7c02fbf52772'
    and delivery_status = 'generated'
    and deleted_at is null
    and is_viewed = true
  returning
    id::text,
    full_name,
    delivery_status,
    first_shared_at::text,
    attendance_status,
    attendee_count,
    is_viewed,
    view_percentage,
    updated_at::text
)
select *
from updated
order by full_name;

commit;
