-- Retire tables with no application reader: the RSVP v1 store (rsvp_records and its audit and
-- channel logs), the one-time legacy adoption receipts and host_profiles. Guest RSVP state lives
-- in guest_invitations; host identity lives in Auth plus app_user_roles.
--
-- Data: export the five tables before applying to a hosted target.

drop function if exists public.backfill_guest_invitations_from_legacy();

drop table if exists public.rsvp_channel_log;
drop table if exists public.rsvp_audit_log;
drop table if exists public.rsvp_records;
drop table if exists public.managed_invitation_legacy_adoption_receipts;
drop table if exists public.host_profiles;
