-- Engagement ranking and invitations domain (contract).
-- Spec: docs/domains/rsvp/engagement-analytics.md
--
-- The admin ranking reads list_invitation_engagement_ranking_v2 since migration
-- 20261013150000, and no application path reads the invitation_projects
-- compatibility view kept by 20260601000001 for the rename rollout.
-- Retire both. Apply only after the Production deployment that serves the v2
-- ranking client passed smoke.
begin;

drop function if exists public.list_invitation_engagement_ranking(text, text);

drop view if exists public.invitation_projects;

commit;
