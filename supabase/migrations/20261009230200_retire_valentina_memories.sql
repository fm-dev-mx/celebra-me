-- Retire the client-named Valentina memories catalog. Its event ended on 2026-08-29; the
-- application reads only the event_memory_* catalog, and validate:deployed-app-capabilities already
-- rejects any reference to these objects.
--
-- Data and media: export the three tables and the referenced storage objects before applying to a
-- hosted target; object deletion is a separate owner step.

drop function if exists public.anonymize_valentina_memory_session(text, uuid, text, text, timestamptz);
drop function if exists public.claim_valentina_memory_cleanup(uuid, integer, integer);
drop function if exists public.claim_valentina_memory_validation(uuid, uuid);
drop function if exists public.expire_valentina_memory_reservations(timestamptz, timestamptz);
drop function if exists public.finalize_valentina_memory_item(uuid, uuid, text, timestamptz);
drop function if exists public.purge_valentina_memory_audit(timestamptz);
drop function if exists public.release_valentina_memory_reservation(uuid, uuid);
drop function if exists public.reserve_valentina_memory_item(
  text, uuid, text, text, bigint, text, numeric, uuid, integer, integer, bigint, integer, integer, bigint
);

drop table if exists public.valentina_memory_audit_events;
drop table if exists public.valentina_memory_items;
drop table if exists public.valentina_memory_sessions;
