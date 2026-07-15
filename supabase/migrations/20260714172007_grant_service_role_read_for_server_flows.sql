-- Restore the minimum privileges required by server-side validation
-- and public invitation resolution.
grant select on table public.events to service_role;
grant select on table public.published_invitation_content to service_role;
grant select on table public.invitations to service_role;
grant select on table public.guest_invitations to service_role;
