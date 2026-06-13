begin;

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('xv', 'boda', 'bautizo', 'cumple', 'baby-shower'));

alter table public.invitations
  drop constraint if exists invitations_event_type_check;

alter table public.invitations
  drop constraint if exists invitation_projects_event_type_check;

alter table public.invitations
  add constraint invitations_event_type_check
  check (event_type in ('xv', 'boda', 'bautizo', 'cumple', 'baby-shower'));

comment on constraint events_event_type_check on public.events is
  'Supported RSVP event types, including native Baby Shower.';

comment on constraint invitations_event_type_check on public.invitations is
  'Supported invitation event types, including native Baby Shower.';

commit;
