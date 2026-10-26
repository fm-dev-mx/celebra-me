-- Meta conversion outbox browser PageView and ViewContent rows: which event and trigger pairs the
-- shape check accepts and refuses, and the retention purge that now covers them.
begin;
select plan(8);

select lives_ok(
  $$insert into public.meta_conversion_events
      (event_name, event_id, trigger_status, session_id, event_source_path, status) values
      ('PageView', 'meta-view-1', 'page_viewed', 'c3000000-0000-4000-8000-000000000001', '/', 'pending'),
      ('ViewContent', 'meta-view-2', 'demo_viewed', 'c3000000-0000-4000-8000-000000000001', '/demos/xv', 'pending'),
      ('ViewContent', 'meta-view-3', 'package_viewed', 'c3000000-0000-4000-8000-000000000001', '/', 'pending')$$,
  'a PageView from page_viewed and a ViewContent from demo_viewed or package_viewed are accepted'
);

select throws_ok(
  $$insert into public.meta_conversion_events
      (event_name, event_id, trigger_status, session_id, status) values
      ('PageView', 'meta-view-4', 'demo_viewed', 'c3000000-0000-4000-8000-000000000001', 'pending')$$,
  '23514',
  null,
  'a PageView with a ViewContent trigger is refused'
);
select throws_ok(
  $$insert into public.meta_conversion_events
      (event_name, event_id, trigger_status, session_id, status) values
      ('ViewContent', 'meta-view-5', 'page_viewed', 'c3000000-0000-4000-8000-000000000001', 'pending')$$,
  '23514',
  null,
  'a ViewContent with the PageView trigger is refused'
);
select throws_ok(
  $$insert into public.meta_conversion_events
      (event_name, event_id, trigger_status, status) values
      ('PageView', 'meta-view-6', 'page_viewed', 'pending')$$,
  '23514',
  null,
  'a PageView without a session is refused'
);
select throws_ok(
  $$insert into public.meta_conversion_events
      (event_name, event_id, trigger_status, session_id, status) values
      ('Contact', 'meta-view-7', 'page_viewed', 'c3000000-0000-4000-8000-000000000001', 'pending')$$,
  '23514',
  null,
  'a Contact keeps its own trigger only'
);

-- Drain rows already past retention so the counts below describe only this fixture.
select public.purge_meta_conversion_retention(5000);

insert into public.meta_conversion_events
  (id, event_name, event_id, trigger_status, session_id, status, created_at) values
  ('f3000000-0000-4000-8000-000000000001', 'PageView', 'meta-view-8', 'page_viewed',
   'c3000000-0000-4000-8000-000000000001', 'sent', now() - interval '31 days'),
  ('f3000000-0000-4000-8000-000000000002', 'ViewContent', 'meta-view-9', 'package_viewed',
   'c3000000-0000-4000-8000-000000000001', 'skipped', now() - interval '31 days'),
  ('f3000000-0000-4000-8000-000000000003', 'ViewContent', 'meta-view-10', 'demo_viewed',
   'c3000000-0000-4000-8000-000000000001', 'sent', now() - interval '29 days');

select is(
  (public.purge_meta_conversion_retention(500)->>'meta_conversion_events')::integer,
  2,
  'the purge deletes the sent PageView and skipped ViewContent older than 30 days'
);
select ok(
  exists (select 1 from public.meta_conversion_events where id = 'f3000000-0000-4000-8000-000000000003'),
  'a ViewContent younger than 30 days stays'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_meta_conversion_events_browser_retention'
  ) and not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_meta_conversion_events_retention'
  ),
  'the retention index covers every browser row'
);

select * from finish();
rollback;
