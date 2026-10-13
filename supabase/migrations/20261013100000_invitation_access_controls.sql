-- Per-invitation commercial access state (expand).
--
-- payment_status drives the unpaid preview watermark on the public invitation;
-- public_access replaces the public invitation with a neutral unavailable page.
-- Both are administrative decisions owned by one environment: publication and
-- promotion never copy them, and the Production to Preview mirror resets them.
--
-- Existing invitations start as paid and enabled, so nothing visible changes when
-- this migration lands. Invitations created afterwards start unpaid.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created
-- object is initialized (revoke/grant) before the first non-initialization
-- statement of the transaction.
begin;

create table public.invitation_access_controls (
  invitation_id uuid primary key references public.invitations (id) on delete cascade,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  public_access text not null default 'enabled' check (public_access in ('enabled', 'disabled')),
  internal_note text check (internal_note is null or char_length(internal_note) <= 280),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

revoke all on table public.invitation_access_controls from public, anon, authenticated, service_role;
alter table public.invitation_access_controls enable row level security;
alter table public.invitation_access_controls force row level security;

-- Every invitation gets its access row on insertion, whichever role inserts it.
create function public.init_invitation_access_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.invitation_access_controls (invitation_id)
  values (new.id)
  on conflict (invitation_id) do nothing;
  return new;
end;
$function$;

revoke all on function public.init_invitation_access_control() from public, anon, authenticated, service_role;

-- The only write path: optimistic version check, update and audit row in one
-- transaction. A null status argument keeps the current value. The internal
-- note travels with public access changes and is never rendered publicly.
create function public.set_invitation_access_control(
  p_invitation_id uuid,
  p_expected_version integer,
  p_actor_id uuid,
  p_payment_status text default null,
  p_public_access text default null,
  p_internal_note text default null
)
returns public.invitation_access_controls
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current public.invitation_access_controls%rowtype;
  v_next public.invitation_access_controls%rowtype;
begin
  if p_payment_status is null and p_public_access is null then
    raise exception using errcode = 'P0001', message = 'invitation_access_no_change';
  end if;
  if p_payment_status is not null and p_payment_status not in ('unpaid', 'paid') then
    raise exception using errcode = '22023', message = 'invitation_access_invalid_payment_status';
  end if;
  if p_public_access is not null and p_public_access not in ('enabled', 'disabled') then
    raise exception using errcode = '22023', message = 'invitation_access_invalid_public_access';
  end if;
  if p_internal_note is not null and char_length(p_internal_note) > 280 then
    raise exception using errcode = '22023', message = 'invitation_access_note_too_long';
  end if;

  perform 1
  from public.invitations i
  where i.id = p_invitation_id
    and i.kind = 'client'
    and i.archived_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'invitation_access_not_found';
  end if;

  insert into public.invitation_access_controls (invitation_id)
  values (p_invitation_id)
  on conflict (invitation_id) do nothing;

  select c.* into v_current
  from public.invitation_access_controls c
  where c.invitation_id = p_invitation_id
  for update;

  if v_current.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'invitation_access_stale';
  end if;

  update public.invitation_access_controls c
  set payment_status = coalesce(p_payment_status, c.payment_status),
      public_access = coalesce(p_public_access, c.public_access),
      internal_note = case when p_public_access is null then c.internal_note else p_internal_note end,
      version = c.version + 1,
      updated_at = now(),
      updated_by = p_actor_id
  where c.invitation_id = p_invitation_id
  returning c.* into v_next;

  insert into public.audit_logs (actor_id, action, target_table, target_id, old_data, new_data)
  values (
    p_actor_id,
    'set_invitation_access_control',
    'invitations',
    p_invitation_id,
    jsonb_build_object(
      'payment_status', v_current.payment_status,
      'public_access', v_current.public_access,
      'version', v_current.version
    ),
    jsonb_build_object(
      'payment_status', v_next.payment_status,
      'public_access', v_next.public_access,
      'version', v_next.version
    )
  );

  return v_next;
end;
$function$;

revoke all on function public.set_invitation_access_control(uuid, integer, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_invitation_access_control(uuid, integer, uuid, text, text, text) to service_role;

-- Reads: service role only (public renderer and admin API run server-side).
grant select on table public.invitation_access_controls to service_role;
create policy invitation_access_controls_service_select on public.invitation_access_controls
  for select to service_role using (true);

create trigger trg_invitations_init_access_control
  after insert on public.invitations
  for each row execute function public.init_invitation_access_control();

-- Existing invitations keep their current public behavior.
insert into public.invitation_access_controls (invitation_id, payment_status, public_access)
select i.id, 'paid', 'enabled'
from public.invitations i
on conflict (invitation_id) do nothing;

comment on table public.invitation_access_controls is 'Per-invitation payment status and public access. Environment-owned administrative state, written only through set_invitation_access_control.';

commit;
