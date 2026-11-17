begin;

-- Host-editable RSVP deadline. A calendar date in the event's time zone; replies
-- are accepted through the end of that day. Null means no deadline (RSVP stays
-- open until the invitation itself becomes unavailable).
alter table public.events
  add column rsvp_deadline date null;

comment on column public.events.rsvp_deadline is
  'Last day (event time zone, inclusive) on which guests may RSVP; null = no deadline.';

commit;
