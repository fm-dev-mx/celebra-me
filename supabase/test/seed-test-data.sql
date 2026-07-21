-- Synthetic test data for disposable test environment
-- Generated for testing purposes only. No PII or production data.

-- 1. Create auth users for admin, client, and unauthorized guest roles
INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test-admin@celebra-me.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test-client@celebra-me.test', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'unauthorized@celebra-me.test', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 2. Define user roles
INSERT INTO public.app_user_roles (user_id, role)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'super_admin'),
  ('a0000000-0000-0000-0000-000000000002', 'host_client'),
  ('a0000000-0000-0000-0000-000000000003', 'host_client')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Create public/demo and private/client invitation projects
INSERT INTO public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'demo-xv-jewelry-box', 'Demo XV Jewelry Box', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'a0000000-0000-0000-0000-000000000001', 'demo'),
  ('f0000000-0000-0000-0000-000000000002', 'test-client-wedding', 'Test Client Wedding', 'boda', 'draft', 'demo-wedding-classic', 'classic', '{}'::jsonb, 'a0000000-0000-0000-0000-000000000002', 'client')
ON CONFLICT (id) DO NOTHING;

-- 4. Create corresponding events linked to the invitations
INSERT INTO public.events (id, slug, title, event_type, owner_user_id, status, invitation_project_id)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'demo-xv-jewelry-box', 'Demo XV Event', 'xv', 'a0000000-0000-0000-0000-000000000001', 'published', 'f0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'test-client-wedding', 'Test Wedding Event', 'boda', 'a0000000-0000-0000-0000-000000000002', 'published', 'f0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 5. Create published invitation content (countdown enabled, ceremony & reception locations)
INSERT INTO public.published_invitation_content (id, invitation_project_id, slug, event_type, is_demo, content, version)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'demo-xv-jewelry-box', 'xv', true,
   '{"title": "Demo XV Jewelry Box", "countdown": {"title": "¡Faltan!", "targetIso": "2026-12-31T20:00:00Z", "footerText": "¡Te esperamos!"}, "sectionOrder": ["hero", "countdown", "locations", "rsvp"], "locations": {"ceremony": {"name": "Parroquia de San José", "address": "Av. Independencia 123", "googleMapsUrl": "https://maps.google.com/?q=Parroquia+San+Jose"}, "reception": {"name": "Hacienda del Sol", "address": "Carr. Federal Km 4.5", "googleMapsUrl": "https://maps.google.com/?q=Hacienda+del+Sol"}}}'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;

-- 6. Create invitation content drafts (countdown disabled)
INSERT INTO public.invitation_content_drafts (id, invitation_project_id, content, status)
VALUES
  ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002',
   '{"title": "Test Client Wedding Draft", "sectionOrder": ["hero", "locations", "rsvp"], "locations": {"ceremony": {"name": "Catedral Metropolitana", "address": "Plaza de la Constitución S/N", "googleMapsUrl": "https://maps.google.com/?q=Catedral+Metropolitana"}}}'::jsonb, 'draft')
ON CONFLICT (id) DO NOTHING;

-- 7. Add uploaded image asset metadata
INSERT INTO public.invitation_assets (id, invitation_id, display_name, default_alt_text, bucket, storage_path, mime_type, width, height, file_size, validation_version, original_mime_type, original_file_size)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'hero_image', 'Foto de bienvenida', 'invitation-assets', 'f0000000-0000-0000-0000-000000000001/hero.webp', 'image/webp', 1200, 800, 153600, 1, 'image/jpeg', 450000)
ON CONFLICT (id) DO NOTHING;

-- 8. Add guest invitations (personalized RSVP, configurable attendee limits, unique tokens)
INSERT INTO public.guest_invitations (id, invite_id, event_id, full_name, phone, country_code, max_allowed_attendees, attendance_status, attendee_count, guest_comment, delivery_status, short_id, hide_celebra_me_branding)
VALUES
  ('90000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Familia Martínez', '6681167477', '+52', 5, 'confirmed', 3, '¡Muchas gracias por invitarnos!', 'shared', 'MARTINEZ', false),
  ('90000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'Sr. Juan Pérez', '6681167478', '+52', 2, 'declined', 0, 'Lamentamos no poder asistir.', 'shared', 'PEREZ', true)
ON CONFLICT (id) DO NOTHING;
