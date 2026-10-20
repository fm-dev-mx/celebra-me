-- Per-invitation guest link code (expand).
--
-- Guest links move from `/i/{short_id}` to `/{slug}/{guest_code}`, e.g. `/america/k7q2`. The
-- code is 4 characters from a 31-character alphabet without look-alikes (no 0/o, 1/l/i), drawn
-- at random (never the guest's name, never a sequence) and unique within the event, so the slug
-- scopes it. 31^4 = 923,521 codes against at most 999 guests per invitation.
--
-- `short_id` and `/i/{short_id}` stay untouched: links already sent keep opening.
--
-- A BEFORE INSERT trigger assigns the code on every insert path (dashboard, bulk import, public
-- RSVP RPC). It takes a per-event advisory lock so two concurrent inserts for the same event can
-- never draw the same code; the unique index remains the final guard. Soft-deleted rows keep
-- their codes, so a code is never handed to a different guest of the same invitation.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created function is
-- initialized (revoke) before the first non-initialization statement of the transaction.
begin;

create function public.generate_guest_code(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bytes bytea;
  v_code text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 100 then
      raise exception 'guest_code space exhausted for event %', p_event_id
        using errcode = 'P0001';
    end if;
    v_bytes := extensions.gen_random_bytes(4);
    v_code := '';
    for i in 0..3 loop
      v_code := v_code || pg_catalog.substr(
        v_alphabet,
        (pg_catalog.get_byte(v_bytes, i) % pg_catalog.length(v_alphabet)) + 1,
        1
      );
    end loop;
    exit when not exists (
      select 1
      from public.guest_invitations gi
      where gi.event_id = p_event_id
        and gi.guest_code = v_code
    );
  end loop;
  return v_code;
end;
$function$;

revoke all on function public.generate_guest_code(uuid) from public, anon, authenticated, service_role;

create function public.guest_invitations_assign_guest_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.guest_code is null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('guest_code:' || new.event_id::text, 0)
    );
    new.guest_code := public.generate_guest_code(new.event_id);
  end if;
  return new;
end;
$function$;

revoke all on function public.guest_invitations_assign_guest_code() from public, anon, authenticated, service_role;

comment on function public.generate_guest_code(uuid) is
  'Random 4-character guest link code (alphabet without 0/o/1/l/i) not yet used by any guest of the event. Called by the guest_invitations insert trigger only.';

alter table public.guest_invitations
  add column guest_code text null;

alter table public.guest_invitations
  add constraint guest_invitations_guest_code_format_chk
  check (guest_code is null or guest_code ~ '^[a-hjkmnp-z2-9]{4}$');

create unique index guest_invitations_event_guest_code_key
  on public.guest_invitations (event_id, guest_code);

comment on column public.guest_invitations.guest_code is
  'Guest link code, unique within the event: the public link is /{events.slug}/{guest_code}. Assigned on insert, never reused after soft delete.';

create trigger guest_invitations_assign_guest_code
  before insert on public.guest_invitations
  for each row
  execute function public.guest_invitations_assign_guest_code();

-- Backfill: one statement, rows in creation order. The generator is volatile, so each call sees
-- the codes assigned to earlier rows of the same statement; the unique index aborts the whole
-- migration (no partial backfill) if that ever failed.
update public.guest_invitations gi
set guest_code = public.generate_guest_code(gi.event_id)
from (
  select id
  from public.guest_invitations
  where guest_code is null
  order by created_at, id
) pending
where gi.id = pending.id;

alter table public.guest_invitations
  alter column guest_code set not null;

commit;
