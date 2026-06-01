-- Application schema audit: PASS/FAIL checks for critical tables, constraints, indexes, RLS and selected RPCs
-- Run in Supabase SQL Editor after migrations
-- Replaces: supabase/snippets/Untitled\ query\ 636.sql (ad-hoc snippet)

with expected_tables as (
  select unnest(array[
    'invitations',
    'events',
    'guest_invitations',
    'guest_invitation_audit',
    'app_user_roles',
    'event_memberships',
    'event_claim_codes',
    'audit_logs',
    'host_profiles',
    'intake_requests',
    'intake_submissions',
    'invitation_content_drafts',
    'published_invitation_content'
  ]) as table_name
),

expected_legacy_tables as (
  select unnest(array[
    'rsvp_records',
    'rsvp_audit_log',
    'rsvp_channel_log'
  ]) as table_name
),

expected_deprecated_rpcs as (
  select unnest(array[
    'soft_delete_event',
    'restore_event',
    'soft_delete_invitation_project',
    'restore_invitation_project',
    'backfill_guest_invitations_from_legacy'
  ]) as rpc_name
),

expected_sensitive_rpcs as (
  select *
  from (values
    ('soft_delete_event', 'uuid, uuid'),
    ('restore_event', 'uuid, uuid'),
    ('upsert_guests_v1', 'uuid, jsonb')
  ) as t(rpc_name, signature)
),

tables_exist as (
  select
    'tables_exist' as check_name,
    case
      when bool_and(t.table_name is not null) then 'PASS'
      else 'FAIL'
    end as status,
    string_agg(e.table_name, ', ' order by e.table_name) filter (where t.table_name is null) as details
  from expected_tables e
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = e.table_name
),

legacy_tables_exist as (
  select
    'legacy_tables_exist' as check_name,
    case
      when bool_and(t.table_name is not null) then 'PASS'
      else 'FAIL'
    end as status,
    string_agg(e.table_name, ', ' order by e.table_name) filter (where t.table_name is null) as details
  from expected_legacy_tables e
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = e.table_name
),

rls_enabled as (
  select
    'rls_enabled_on_app_tables' as check_name,
    case
      when count(*) filter (where not c.relrowsecurity) = 0 then 'PASS'
      else 'FAIL'
    end as status,
    string_agg(c.relname, ', ' order by c.relname) filter (where not c.relrowsecurity) as details
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (select table_name from expected_tables)
),

published_route_unique as (
  select
    'published_invitation_content_unique_event_type_slug' as check_name,
    case
      when exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace n on n.oid = rel.relnamespace
        where n.nspname = 'public'
          and rel.relname = 'published_invitation_content'
          and con.contype = 'u'
          and con.conname = 'published_invitation_content_event_type_slug_key'
      )
      then 'PASS'
      else 'FAIL'
    end as status,
    null::text as details
),

guest_unique_index as (
  select
    'guest_active_unique_event_country_phone' as check_name,
    case
      when exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'guest_invitations'
          and indexdef ilike '%event_id%'
          and indexdef ilike '%country_code%'
          and indexdef ilike '%phone%'
          and indexdef ilike '%deleted_at IS NULL%'
      )
      then 'PASS'
      else 'FAIL'
    end as status,
    null::text as details
),

events_invitation_project_index as (
  select
    'idx_events_unique_invitation_project' as check_name,
    case
      when exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'events'
          and indexname = 'idx_events_unique_invitation_project'
      )
      then 'PASS'
      else 'FAIL'
    end as status,
    null::text as details
),

deprecated_rpcs_exist as (
  select
    'deprecated_rpcs_exist' as check_name,
    case
      when bool_and(p.oid is not null) then 'PASS'
      else 'FAIL'
    end as status,
    string_agg(expected.rpc_name, ', ' order by expected.rpc_name) filter (where p.oid is null) as details
  from expected_deprecated_rpcs expected
  left join pg_proc p
    on p.proname = expected.rpc_name
   and p.pronamespace = 'public'::regnamespace
),

sensitive_rpc_status as (
  select
    s.rpc_name,
    p.oid is not null as function_exists,
    coalesce(has_function_privilege('anon', p.oid, 'EXECUTE'), false) as anon_has_execute,
    coalesce(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) as auth_has_execute,
    coalesce(has_function_privilege('service_role', p.oid, 'EXECUTE'), false) as svc_has_execute
  from expected_sensitive_rpcs s
  left join pg_proc p
    on p.proname = s.rpc_name
   and p.pronamespace = 'public'::regnamespace
),

sensitive_rpc_privileges as (
  select
    'sensitive_rpc_privileges' as check_name,
    case
      when bool_and(st.function_exists
                and not st.anon_has_execute
                and not st.auth_has_execute
                and st.svc_has_execute)
        then 'PASS'
      else 'FAIL'
    end as status,
    (
      select string_agg(msg, ', ' order by msg)
      from (
        select distinct rpc_name || ': function does not exist' as msg
        from sensitive_rpc_status
        where not function_exists
        union all
        select distinct rpc_name || ': anon has EXECUTE'
        from sensitive_rpc_status
        where function_exists and anon_has_execute
        union all
        select distinct rpc_name || ': authenticated has EXECUTE'
        from sensitive_rpc_status
        where function_exists and auth_has_execute
        union all
        select distinct rpc_name || ': service_role lacks EXECUTE'
        from sensitive_rpc_status
        where function_exists and not svc_has_execute
      ) issues
    ) as details
  from sensitive_rpc_status st
),

security_definer_search_path as (
  select
    'security_definer_search_path_public' as check_name,
    case
      when count(*) filter (
        where p.prosecdef
          and not coalesce(p.proconfig::text, '') like '%search_path=public%'
      ) = 0 then 'PASS'
      else 'FAIL'
    end as status,
    string_agg(p.proname, ', ' order by p.proname) filter (
      where p.prosecdef
        and not coalesce(p.proconfig::text, '') like '%search_path=public%'
    ) as details
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
),

upsert_function_conflict_target as (
  select
    'upsert_guests_v1_conflict_target' as check_name,
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'upsert_guests_v1'
          and p.prosrc ilike '%on conflict (event_id, country_code, phone)%'
          and p.prosrc ilike '%where deleted_at is null%'
      )
      then 'PASS'
      else 'FAIL'
    end as status,
    null::text as details
),

event_slug_parity as (
  with reconciliation_pairs (event_type, source_slug, target_slug) as (
    values
      ('cumple', 'demo-gerardo-sesenta', 'gerardo-sesenta'),
      ('xv', 'demo-xv', 'ximena-meza-trasvina')
  ),
  pair_status as (
    select
      pair.event_type,
      pair.source_slug,
      pair.target_slug,
      source_event.id is not null as source_exists,
      target_event.id is not null as target_exists
    from reconciliation_pairs pair
    left join public.events source_event
      on source_event.slug = pair.source_slug
     and source_event.event_type = pair.event_type
    left join public.events target_event
      on target_event.slug = pair.target_slug
     and target_event.event_type = pair.event_type
  )
  select
    'event_slug_parity' as check_name,
    case
      when bool_and(not source_exists) then 'PASS'
      else 'FAIL'
    end as status,
    (
      select string_agg(msg, ', ' order by msg)
      from (
        select format('%s/%s: source event still exists (target: %s)',
          ps.event_type, ps.source_slug,
          case when ps.target_exists then 'present' else 'missing' end
        ) as msg
        from pair_status ps
        where ps.source_exists
      ) issues
    ) as details
  from pair_status
)

select * from tables_exist
union all select * from legacy_tables_exist
union all select * from rls_enabled
union all select * from published_route_unique
union all select * from guest_unique_index
union all select * from events_invitation_project_index
union all select * from deprecated_rpcs_exist
union all select * from sensitive_rpc_privileges
union all select * from security_definer_search_path
union all select * from upsert_function_conflict_target
union all select * from event_slug_parity
order by check_name;
