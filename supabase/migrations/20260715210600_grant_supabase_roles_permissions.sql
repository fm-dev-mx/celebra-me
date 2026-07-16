-- Establish least-privilege privileges and default privileges for Supabase roles.
-- Ensures client roles (anon, authenticated) have no administrative privileges (TRUNCATE, REFERENCES, TRIGGER),
-- and limits table and function access to only what is explicitly required by application logic.

begin;

-- 1. REVOKE EVERYTHING from client roles to establish a clean slate
revoke all privileges on all tables in schema public from public, anon, authenticated, service_role;
revoke all privileges on all sequences in schema public from public, anon, authenticated, service_role;
revoke all privileges on all routines in schema public from public, anon, authenticated, service_role;

-- Revoke default privileges in schema public for all roles
alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from public, anon, authenticated, service_role;

-- 2. GRANT LEAST-PRIVILEGE TO SERVICE_ROLE (Server BFF Bypass role)
-- Grant data-manipulation privileges only (no TRUNCATE, REFERENCES, TRIGGER)
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all routines in schema public to service_role;

-- 3. GRANT LEAST-PRIVILEGE TO AUTHENTICATED (Host/Dashboard role)
-- Grant access only to tables protected by host RLS policies (no TRUNCATE, REFERENCES, TRIGGER)
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.guest_invitations to authenticated;
grant select, insert, update, delete on public.event_memberships to authenticated;
grant select, insert, update, delete on public.host_profiles to authenticated;
grant select, insert, update, delete on public.app_user_roles to authenticated;
grant select, insert, update, delete on public.guest_invitation_audit to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;
grant select, insert, update, delete on public.intake_requests to authenticated;
grant select, insert, update, delete on public.intake_submissions to authenticated;
grant select, insert, update, delete on public.invitation_content_drafts to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.published_invitation_content to authenticated;
grant select, insert, update, delete on public.invitation_assets to authenticated;
grant select, insert, update, delete on public.rsvp_records to authenticated;
grant select, insert, update, delete on public.rsvp_audit_log to authenticated;
grant select, insert, update, delete on public.rsvp_channel_log to authenticated;
grant select on public.deleted_events to authenticated;
grant select on public.invitation_projects to authenticated;
grant select on public.archived_invitations to authenticated;

-- Grant usage/select on all sequences (needed if auto-increment is added in future)
grant usage, select on all sequences in schema public to authenticated;

-- 4. GRANT LEAST-PRIVILEGE TO ANON (Public Anonymous Guest role)
-- Grant SELECT access only to public invitation content and public assets (no direct writes)
grant select on public.published_invitation_content to anon;
grant select on public.invitation_assets to anon;

-- 5. FUNCTION ALLOWLIST (SECURE EXECUTE PRIVILEGES)
-- By default, all routines have execute revoked. We explicitly grant execute to required roles.
-- A. Trigger functions (must be executable by role performing the transaction)
grant execute on function public.touch_updated_at() to authenticated, service_role;
grant execute on function public.set_last_updated_at() to authenticated, service_role;
grant execute on function public.sync_user_role_to_metadata() to authenticated, service_role;
grant execute on function public.guest_invitation_emit_audit() to authenticated, service_role;

-- B. Application-level public-facing RPCs
grant execute on function public.upsert_guests_v1(uuid, jsonb) to authenticated;
grant execute on function public.is_admin_user() to authenticated;

-- 6. SET LEAST-PRIVILEGE DEFAULT PRIVILEGES FOR FUTURE TABLES & FUNCTIONS
-- Future tables: service_role gets select/insert/update/delete; authenticated gets nothing by default (must be explicitly granted); anon gets nothing.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select, update on sequences to service_role;

commit;
