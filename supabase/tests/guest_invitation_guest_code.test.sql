-- Guest link codes: every insert path gets a random 4-character code without look-alikes,
-- unique within its event only, and the generator stays private.
begin;
select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('e5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'guest-code-owner@example.test', now(), now());

insert into public.events (id, owner_user_id, slug, event_type, title, status) values
  ('e5100000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', 'guest-code-a', 'xv', 'Guest code A', 'published'),
  ('e5100000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000001', 'guest-code-b', 'boda', 'Guest code B', 'published');

-- 999 guests in one statement: the most an invitation may have.
insert into public.guest_invitations (event_id, full_name, max_allowed_attendees)
select 'e5100000-0000-4000-8000-000000000001', 'Invitado ' || n, 1
from generate_series(1, 999) as n;

select is(
  (select count(distinct guest_code)::integer from public.guest_invitations
   where event_id = 'e5100000-0000-4000-8000-000000000001'),
  999,
  'a single 999-guest insert gets 999 distinct codes'
);

select is(
  (select count(*)::integer from public.guest_invitations
   where event_id = 'e5100000-0000-4000-8000-000000000001'
     and guest_code !~ '^[a-hjkmnp-z2-9]{4}$'),
  0,
  'every code is 4 characters without 0, o, 1, l or i'
);

-- A code may repeat in another invitation: the slug scopes it.
insert into public.guest_invitations (event_id, full_name, max_allowed_attendees, guest_code)
select 'e5100000-0000-4000-8000-000000000002', 'Invitado repetido', 1, guest_code
from public.guest_invitations
where event_id = 'e5100000-0000-4000-8000-000000000001'
limit 1;

select is(
  (select count(*)::integer from public.guest_invitations
   where event_id = 'e5100000-0000-4000-8000-000000000002'),
  1,
  'the same code is accepted in a different invitation'
);

select throws_ok(
  $sql$
    insert into public.guest_invitations (event_id, full_name, max_allowed_attendees, guest_code)
    select event_id, 'Duplicado', 1, guest_code
    from public.guest_invitations
    where event_id = 'e5100000-0000-4000-8000-000000000001'
    limit 1
  $sql$,
  '23505',
  null,
  'a code cannot repeat inside one invitation'
);

select throws_ok(
  $sql$
    insert into public.guest_invitations (event_id, full_name, max_allowed_attendees, guest_code)
    values ('e5100000-0000-4000-8000-000000000002', 'Confuso', 1, 'o1l0')
  $sql$,
  '23514',
  null,
  'a code with look-alike characters is rejected'
);

select col_not_null('public', 'guest_invitations', 'guest_code', 'guest_code is required');

select ok(
  not has_function_privilege('anon', 'public.generate_guest_code(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.generate_guest_code(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.generate_guest_code(uuid)', 'EXECUTE'),
  'no API role can call the generator directly'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.generate_guest_code(uuid)'::regprocedure)
  and (select proconfig @> array['search_path=""'] from pg_proc
       where oid = 'public.generate_guest_code(uuid)'::regprocedure),
  'the generator is security definer with an empty search_path'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.guest_invitations'::regclass
      and tgname = 'guest_invitations_assign_guest_code'
      and not tgisinternal
  ),
  'the insert trigger assigns codes'
);

select * from finish();
rollback;
