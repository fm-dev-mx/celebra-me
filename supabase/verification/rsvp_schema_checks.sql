-- RSVP schema verification checklist
-- Run in Supabase SQL Editor after migrations

-- 1) Tables should exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('rsvp_records', 'rsvp_audit_log', 'rsvp_channel_log')
order by table_name;

-- 2) Core constraints and foreign keys
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid::regclass::text in ('rsvp_records', 'rsvp_audit_log', 'rsvp_channel_log')
order by conrelid::regclass::text, conname;

-- 3) Trigger for last_updated_at
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'rsvp_records'
order by trigger_name;

-- 4) Index coverage
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('rsvp_records', 'rsvp_audit_log', 'rsvp_channel_log')
order by tablename, indexname;

-- 5) RLS status
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('rsvp_records', 'rsvp_audit_log', 'rsvp_channel_log')
order by tablename;

-- 6) RLS policies should block anon/authenticated
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('rsvp_records', 'rsvp_audit_log', 'rsvp_channel_log')
order by tablename, policyname;

-- 7) Data integrity checks (expect failures)
-- Run manually, one by one, to confirm constraints:
-- insert into public.rsvp_records(store_key,rsvp_id,event_slug,guest_name_entered,attendance_status,attendee_count,source,normalized_guest_name)
-- values ('tmp::declined_bad','rsvp_tmp_bad','gerardo-sesenta','QA','declined',2,'generic_link','qa');
--
-- insert into public.rsvp_records(store_key,rsvp_id,event_slug,guest_name_entered,attendance_status,attendee_count,source,normalized_guest_name)
-- values ('tmp::confirmed_bad','rsvp_tmp_bad2','gerardo-sesenta','QA','confirmed',0,'generic_link','qa');
