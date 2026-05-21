-- Migration: Normalize existing phone values to E.164-like format (+52 prefix)
-- Path: supabase/migrations/20260521000001_normalize_phone_format.sql
--
-- Only affects guest_invitations.phone values that match:
--   - exactly 10 digits (/^[0-9]{10}$/)
--   - no '+' prefix
--   - not a PENDING_ placeholder
--   - not null or empty
--
-- These are assumed to be Mexican mobile numbers entered through the
-- previous system that validated only for 10-digit MX format.
-- Converting them to +52XXXXXXXXXX ensures round-trip compatibility
-- with the explicit country_code import/export contract.

begin;

-- Preview step (run separately to check impact):
--   select count(*) from public.guest_invitations
--   where phone ~ '^\d{10}$'
--     and phone not like '+%'
--     and phone not like 'PENDING_%';

update public.guest_invitations
set phone = '+52' || phone
where phone ~ '^\d{10}$'
  and phone not like '+%'
  and phone not like 'PENDING_%';

commit;
