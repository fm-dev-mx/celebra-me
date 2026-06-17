-- @script-id: 20260617_refine_luna_y_estrella_rsvp_copy
-- @purpose: Shorten confirmed RSVP title and refine location heading for Luna y Estrella Primera Comunión
-- @env: production
-- @ticket: CELEBRA-PREMIUM-RSVP-2
-- @tables: public.published_invitation_content
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select slug, event_type, content->'rsvp'->'responseMessages'->'confirmed'->>'title' as old_title, content->'location'->>'introHeading' as old_introheading from public.published_invitation_content where slug = 'luna-y-estrella' and event_type = 'primera-comunion';
-- @rollback: restore the published_invitation_content row for slug luna-y-estrella, event_type primera-comunion from backup

begin;

update public.published_invitation_content
set content = jsonb_set(
  jsonb_set(
    content,
    '{rsvp,responseMessages,confirmed,title}',
    '"Gracias por confirmar"'::jsonb
  ),
  '{location,introHeading}',
  '"Detalles de la celebración"'::jsonb
),
    version = version + 1,
    published_at = now()
where slug = 'luna-y-estrella'
  and event_type = 'primera-comunion'
  and deleted_at is null;

commit;
