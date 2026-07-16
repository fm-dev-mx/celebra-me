-- Synthetic test data for disposable test environment
-- Generated for testing purposes only. No PII or production data.

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test-admin@celebra-me.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test-client@celebra-me.test', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, slug, title, event_type, owner_user_id, status)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'test-xv-event', 'Test XV Event', 'xv', 'a0000000-0000-0000-0000-000000000001', 'published'),
  ('e0000000-0000-0000-0000-000000000002', 'test-wedding-event', 'Test Wedding Event', 'boda', 'a0000000-0000-0000-0000-000000000001', 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'test-invitation-xv', 'Test XV Invitation', 'xv', 'draft', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'a0000000-0000-0000-0000-000000000001', 'client'),
  ('f0000000-0000-0000-0000-000000000002', 'test-invitation-wedding', 'Test Wedding Invitation', 'boda', 'draft', 'demo-wedding-classic', 'classic', '{}'::jsonb, 'a0000000-0000-0000-0000-000000000002', 'client')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user_roles (user_id, role)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'super_admin'),
  ('a0000000-0000-0000-0000-000000000002', 'host_client')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.published_invitation_content (id, invitation_project_id, slug, event_type, content, version)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'test-invitation-xv', 'xv', '{"title":"Test XV Invitation"}'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;
