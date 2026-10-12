-- Per-event branding removal add-on. The number of guests that may hide Celebra-me branding moves
-- from an application constant keyed by slug to the event row; 0 means the add-on is off.

alter table public.events
  add column if not exists branding_removal_guest_limit integer not null default 0;

alter table public.events
  add constraint events_branding_removal_guest_limit_check
  check (branding_removal_guest_limit >= 0);

comment on column public.events.branding_removal_guest_limit is
  'Guests allowed to hide Celebra-me branding on their personalized invitation; 0 disables the add-on.';

-- The only event sold with the add-on (previously hardcoded in the application).
update public.events
set branding_removal_guest_limit = 10
where event_type = 'bautizo'
  and slug = 'cesar-ramses'
  and branding_removal_guest_limit = 0;
