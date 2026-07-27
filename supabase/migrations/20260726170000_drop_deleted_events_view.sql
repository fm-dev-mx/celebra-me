-- Drop deprecated soft-delete trash view.
-- Unused by application code; Production already lacked this view.
-- Replacement surface: archived invitations / invitation archive flows.

begin;

drop view if exists public.deleted_events;

commit;
