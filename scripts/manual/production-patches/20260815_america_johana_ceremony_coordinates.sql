-- @script-id: 20260815_america_johana_ceremony_coordinates
-- @purpose: Align America Johana ceremony coordinates with the Coyoacán Rectoría place already linked by googleMapsUrl
-- @env: production
-- @ticket: operator-note: america-johana ceremony map pin was ~570m west of Av. División del Nte. 3430
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 2
-- @requires-backup: true
-- @paired-stores: published,draft
-- @pair-key: slug
-- @dry-run-query: select 'published' as store, content#>'{location,ceremony,coordinates}' as ceremony_coordinates from public.published_invitation_content where slug = 'america-johana' and event_type = 'xv' and deleted_at is null union all select 'draft' as store, d.content#>'{location,ceremony,coordinates}' from public.invitation_content_drafts d join public.invitations i on i.id = d.invitation_project_id where i.slug = 'america-johana' and i.event_type = 'xv' and d.deleted_at is null
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for america-johana from the pre-apply Production backup

begin;

update public.published_invitation_content
set content = jsonb_set(
  content,
  '{location,ceremony,coordinates}',
  '{"lat": 19.2759461, "lng": -99.5176924}'::jsonb
),
    version = version + 1,
    published_at = now()
where slug = 'america-johana'
  and event_type = 'xv'
  and deleted_at is null
  and content#>'{location,ceremony,coordinates}' = '{"lat": 19.3278767, "lng": -99.1468354}'::jsonb;

update public.invitation_content_drafts d
set content = jsonb_set(
  d.content,
  '{location,ceremony,coordinates}',
  '{"lat": 19.2759461, "lng": -99.5176924}'::jsonb
)
from public.invitations i
where d.invitation_project_id = i.id
  and i.slug = 'america-johana'
  and i.event_type = 'xv'
  and d.deleted_at is null
  and d.content#>'{location,ceremony,coordinates}' = '{"lat": 19.3278767, "lng": -99.1468354}'::jsonb;

commit;
