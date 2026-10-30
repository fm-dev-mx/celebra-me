begin;
select plan(13);
insert into public.customers (id, display_name) values
  ('a4000000-0000-4000-8000-000000000001', 'Synthetic draft customer');
insert into public.sales_orders (id, order_number, customer_id, event_type, total_amount, status, package_name)
values ('b4000000-0000-4000-8000-000000000001', 'DRAFT-TEST',
  'a4000000-0000-4000-8000-000000000001', 'xv', 1800, 'confirmed', 'Esencial');
insert into public.invitation_data_requests (order_id, token_hash, expires_at)
values ('b4000000-0000-4000-8000-000000000001', repeat('d', 64), now() + interval '1 day');

create function pg_temp.try_draft() returns jsonb language sql as $$
  select public.create_order_invitation_draft('b4000000-0000-4000-8000-000000000001',
    (select updated_at from public.invitation_data_requests where order_id = 'b4000000-0000-4000-8000-000000000001'),
    'synthetic-draft-order', 'editorial', '{"title":"Synthetic celebration","eventType":"xv"}'::jsonb);
$$;
select ok(not has_function_privilege('anon', 'public.create_order_invitation_draft(uuid,timestamptz,text,text,jsonb)', 'EXECUTE'), 'anon cannot create drafts');
select ok(not has_function_privilege('authenticated', 'public.create_order_invitation_draft(uuid,timestamptz,text,text,jsonb)', 'EXECUTE'), 'authenticated cannot bypass strong admin API');
select is(pg_temp.try_draft()->>'error', 'unpaid', 'unpaid order is rejected');
update public.sales_orders set status = 'paid' where order_number = 'DRAFT-TEST';
select is(pg_temp.try_draft()->>'error', 'not_submitted', 'unsubmitted data is rejected');
update public.invitation_data_requests set status = 'submitted', submitted_at = now(),
  answers = '{"celebrantNames":"Synthetic celebration","eventDate":"2026-12-12","notes":"Private instructions"}'
  where order_id = 'b4000000-0000-4000-8000-000000000001';
select is(public.create_order_invitation_draft('b4000000-0000-4000-8000-000000000001',
  '2000-01-01', 'synthetic-draft-order', 'editorial', '{"title":"Test","eventType":"xv"}')->>'error', 'stale', 'stale input is rejected');
-- Exercise actual runtime privileges, not the migration owner's privileges.
set local role service_role;
select is(pg_temp.try_draft()->>'created', 'true', 'service role creates the invitation and draft');
reset role;
select is((select count(*)::integer from public.invitations where slug = 'synthetic-draft-order'), 1, 'exactly one invitation');
select is((select status from public.invitations where slug = 'synthetic-draft-order'), 'draft', 'nothing is published');
select is((select d.content->'orderSource'->>'packageName' from public.invitation_content_drafts d
  join public.sales_orders o on o.invitation_id = d.invitation_project_id where o.order_number = 'DRAFT-TEST'), 'Esencial', 'package snapshot retained');
update public.invitation_content_drafts set content = content || '{"title":"Owner edit"}'
  where invitation_project_id = (select invitation_id from public.sales_orders where order_number = 'DRAFT-TEST');
select is(pg_temp.try_draft()->>'created', 'false', 'repeated request opens original');
select is((select d.content->>'title' from public.invitation_content_drafts d
  join public.sales_orders o on o.invitation_id = d.invitation_project_id where o.order_number = 'DRAFT-TEST'), 'Owner edit', 'owner changes preserved');
select throws_ok($$insert into public.sales_orders (order_number, customer_id, event_type, total_amount, invitation_id)
  select 'DRAFT-DUPLICATE', customer_id, event_type, total_amount, invitation_id from public.sales_orders where order_number = 'DRAFT-TEST'$$,
  '23505', null, 'invitation cannot link to a second order');
update public.invitations set archived_at = now() where slug = 'synthetic-draft-order';
select is(pg_temp.try_draft()->>'error', 'unavailable', 'archived invitation is not silently recreated');
select * from finish();
rollback;
