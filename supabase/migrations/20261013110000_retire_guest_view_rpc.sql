-- Guest engagement analytics (contract).
-- Spec: docs/domains/rsvp/engagement-analytics.md
--
-- The application records opens, depth and RSVP form steps through
-- record_guest_engagement_events_public since migration 20261010120000 and no
-- longer serves /api/invitacion/:inviteId/view. Retire the legacy view RPC.
-- Apply only after a smoke-checked Production deployment that provides the
-- guest_engagement_only_client capability.
begin;

drop function if exists public.track_guest_invitation_view_public(text, integer);

commit;
