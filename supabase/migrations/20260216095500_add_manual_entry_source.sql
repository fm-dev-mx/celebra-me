-- Migration to allow 'manual_entry' in the source check constraint
begin;

-- Drop the old constraint
alter table public.rsvp_records
  drop constraint if exists rsvp_records_source_check;

-- Add the updated constraint including 'manual_entry'
alter table public.rsvp_records
  add constraint rsvp_records_source_check
  check (source in ('personalized_link', 'generic_link', 'admin', 'manual_entry'));

commit;
