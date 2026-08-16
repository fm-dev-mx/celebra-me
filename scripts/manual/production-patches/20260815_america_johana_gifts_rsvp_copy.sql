-- @script-id: 20260815_america_johana_gifts_rsvp_copy
-- @purpose: Remove the past RSVP deadline indication and add Sears/Liverpool event numbers on America Johana
-- @env: production
-- @ticket: operator-note: america-johana client asked to drop the 1 Aug confirmation date and show gift-registry event numbers
-- @tables: public.published_invitation_content, public.invitation_content_drafts
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 2
-- @requires-backup: true
-- @paired-stores: published,draft
-- @pair-key: slug
-- @dry-run-query: select 'published' as store, slug from public.published_invitation_content where slug = 'america-johana' and event_type = 'xv' and deleted_at is null and (jsonb_array_length(coalesce(content->'gifts'->'items', '[]'::jsonb)) is distinct from 3 or content#>>'{gifts,items,0,tableNumber}' is distinct from '52006296' or exists (select 1 from jsonb_array_elements(coalesce(content->'location'->'indications', '[]'::jsonb)) elem where elem->>'text' like '%1 de agosto de 2026%')) union all select 'draft' as store, i.slug from public.invitation_content_drafts d join public.invitations i on i.id = d.invitation_project_id where i.slug = 'america-johana' and i.event_type = 'xv' and d.deleted_at is null and (jsonb_array_length(coalesce(d.content->'gifts'->'items', '[]'::jsonb)) is distinct from 3 or d.content#>>'{gifts,items,0,tableNumber}' is distinct from '52006296' or exists (select 1 from jsonb_array_elements(coalesce(d.content->'location'->'indications', '[]'::jsonb)) elem where elem->>'text' like '%1 de agosto de 2026%'))
-- @rollback: restore public.published_invitation_content and matching invitation_content_drafts for america-johana from the pre-apply Production backup

begin;

update public.published_invitation_content
set content = jsonb_set(
  jsonb_set(
    content,
    '{gifts,items}',
    '[{"type": "store", "title": "Liverpool", "description": "Mesa de regalos digital Liverpool", "tableNumber": "52006296", "url": "https://mesaderegalos.liverpool.com.mx/milistaderegalos/52006296"}, {"type": "store", "title": "Sears", "description": "Mesa de regalos digital Sears", "tableNumber": "237993", "url": "https://www.sears.com.mx/Mesa-de-Regalos/237993/te-invito-a-mi-xv-anos-america"}, {"type": "cash", "title": "Lluvia de sobres", "text": "También contaremos con un espacio especial durante la recepción."}]'::jsonb
  ),
  '{location,indications}',
  coalesce(
    (
      select jsonb_agg(elem)
      from jsonb_array_elements(content->'location'->'indications') as elem
      where elem->>'text' not like '%1 de agosto de 2026%'
    ),
    '[]'::jsonb
  )
),
    version = version + 1,
    published_at = now()
where slug = 'america-johana'
  and event_type = 'xv'
  and deleted_at is null
  and (
    jsonb_array_length(coalesce(content->'gifts'->'items', '[]'::jsonb)) is distinct from 3
    or content#>>'{gifts,items,0,tableNumber}' is distinct from '52006296'
    or exists (
      select 1
      from jsonb_array_elements(coalesce(content->'location'->'indications', '[]'::jsonb)) elem
      where elem->>'text' like '%1 de agosto de 2026%'
    )
  );

update public.invitation_content_drafts d
set content = jsonb_set(
  jsonb_set(
    d.content,
    '{gifts,items}',
    '[{"type": "store", "title": "Liverpool", "description": "Mesa de regalos digital Liverpool", "tableNumber": "52006296", "url": "https://mesaderegalos.liverpool.com.mx/milistaderegalos/52006296"}, {"type": "store", "title": "Sears", "description": "Mesa de regalos digital Sears", "tableNumber": "237993", "url": "https://www.sears.com.mx/Mesa-de-Regalos/237993/te-invito-a-mi-xv-anos-america"}, {"type": "cash", "title": "Lluvia de sobres", "text": "También contaremos con un espacio especial durante la recepción."}]'::jsonb
  ),
  '{location,indications}',
  coalesce(
    (
      select jsonb_agg(elem)
      from jsonb_array_elements(d.content->'location'->'indications') as elem
      where elem->>'text' not like '%1 de agosto de 2026%'
    ),
    '[]'::jsonb
  )
)
from public.invitations i
where d.invitation_project_id = i.id
  and i.slug = 'america-johana'
  and i.event_type = 'xv'
  and d.deleted_at is null
  and (
    jsonb_array_length(coalesce(d.content->'gifts'->'items', '[]'::jsonb)) is distinct from 3
    or d.content#>>'{gifts,items,0,tableNumber}' is distinct from '52006296'
    or exists (
      select 1
      from jsonb_array_elements(coalesce(d.content->'location'->'indications', '[]'::jsonb)) elem
      where elem->>'text' like '%1 de agosto de 2026%'
    )
  );

commit;
