-- Host curation, thumbnails and the shareable gallery for event memories.
--
-- event_memory_items
--   hidden_at             The host hid the file from the shared gallery and from
--                         "download all". Hiding is reversible and never changes
--                         status, cleanup scheduling or the accepted-checksum index.
--   thumbnail_object_key  A small WebP the guest's browser renders after the upload
--   thumbnail_bytes       is confirmed. Both are set together or not at all, and a
--                         thumbnail never exceeds 96 KiB. It does not count against
--                         any quota and is deleted together with its original.
--
-- event_memory_settings
--   share_version         Bumped to revoke the current share link; the link token
--                         is an HMAC of (event id, version) and is never stored.
--   share_enabled_at      NULL while the shared gallery is off.
--
-- Additive only. Every new column is nullable or has a default, existing rows keep
-- their behavior, and the tables' access boundary (forced RLS, service-role-only
-- policies) is unchanged. No RPC changes: claim_event_memory_cleanup already
-- returns every column, so the cleanup job sees the thumbnail key.

begin;

alter table public.event_memory_items
	add column hidden_at timestamptz null,
	add column thumbnail_object_key text null,
	add column thumbnail_bytes integer null;

alter table public.event_memory_items
	add constraint event_memory_items_thumbnail_pair_check
		check ((thumbnail_object_key is null) = (thumbnail_bytes is null)),
	add constraint event_memory_items_thumbnail_bytes_check
		check (thumbnail_bytes is null or thumbnail_bytes between 1 and 98304),
	add constraint event_memory_items_thumbnail_key_check
		check (thumbnail_object_key is null or thumbnail_object_key like 'events/%/thumbs/%.webp');

alter table public.event_memory_settings
	add column share_version integer not null default 0,
	add column share_enabled_at timestamptz null;

alter table public.event_memory_settings
	add constraint event_memory_settings_share_version_check
		check (share_version >= 0);

commit;

notify pgrst, 'reload schema';
