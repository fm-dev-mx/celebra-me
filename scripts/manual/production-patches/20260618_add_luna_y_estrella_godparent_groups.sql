-- @script-id: 20260618_add_luna_y_estrella_godparent_groups
-- @purpose: Add grouped godparents by honoree to Luna y Estrella published invitation content
-- @env: production
-- @ticket: CELEBRA-LUNA-ESTRELLA-GODPARENTS
-- @tables: public.published_invitation_content
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select slug, event_type, content->'family' as family from public.published_invitation_content where slug = 'luna-y-estrella' and event_type = 'primera-comunion' and deleted_at is null;
-- @rollback: restore the published_invitation_content row for slug luna-y-estrella, event_type primera-comunion from backup
-- One-time patch: re-running would update the same JSON paths again and increment version/published_at again.

begin;

update public.published_invitation_content
set content = jsonb_set(
  jsonb_set(
    content,
    '{family,labels,godparentsTitle}',
    '"Padrinos"'::jsonb,
    true
  ),
  '{family,godparentGroups}',
  '[
    {
      "honoreeName": "Luna Yamileth Villa Báez",
      "label": "Luna",
      "godparents": [
        { "name": "Emiliano Pérez Rodríguez" }
      ]
    },
    {
      "honoreeName": "Estrella Abigail Villa Báez",
      "label": "Estrella",
      "godparents": [
        { "name": "María Guadalupe Villa Ponce" }
      ]
    }
  ]'::jsonb,
  true
),
    version = version + 1,
    published_at = now()
where slug = 'luna-y-estrella'
  and event_type = 'primera-comunion'
  and deleted_at is null;

commit;
