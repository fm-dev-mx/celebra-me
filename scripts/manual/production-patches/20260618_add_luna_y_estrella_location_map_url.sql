-- @script-id: 20260618_add_luna_y_estrella_location_map_url
-- @purpose: Add googleMapsUrl to Luna y Estrella published venue (was missing from original publish patch)
-- @env: production
-- @tables: public.published_invitation_content
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select slug, event_type, content->'location' from public.published_invitation_content where slug = 'luna-y-estrella' and event_type = 'primera-comunion' and deleted_at is null;
-- @rollback: restore the published_invitation_content row for slug luna-y-estrella, event_type primera-comunion from backup

begin;

update public.published_invitation_content
set content = jsonb_set(
  content,
  '{location,venues,0,googleMapsUrl}',
  '"https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20Garc%C3%ADa%2C%20Victoriano%20Huerta%2051%2C%20Col.%20San%20Francisco%2C%20Uruapan"'::jsonb
),
    version = version + 1,
    published_at = now()
where slug = 'luna-y-estrella'
  and event_type = 'primera-comunion'
  and deleted_at is null;

commit;
