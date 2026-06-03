-- Migration: Create invitation_assets table for per-invitation image library.
--
-- This table stores metadata for user-uploaded images, isolated per invitation.
-- Storage objects live in the 'invitation-assets' Supabase Storage bucket.
-- Deletion is soft-delete only; storage objects are preserved while any
-- draft or published snapshot references the asset.
--
-- Storage paths are immutable and must never be reused. The unique constraint
-- on (bucket, storage_path) is non-partial so that even soft-deleted rows
-- reserve the path and prevent accidental overwrite.

begin;

-- ============================================================================
-- 1. Create invitation_assets table
-- ============================================================================

create table invitation_assets (
	id              uuid primary key default gen_random_uuid(),
	invitation_id   uuid not null references invitations(id) on delete cascade,
	display_name    text not null,
	default_alt_text text,
	bucket          text not null default 'invitation-assets',
	storage_path    text not null,
	mime_type       text not null default 'image/webp',
	width           integer,
	height          integer,
	file_size       integer,
	created_at      timestamptz not null default now(),
	updated_at      timestamptz not null default now(),
	deleted_at      timestamptz
);

-- Non-partial unique: storage paths are immutable and must never be reused,
-- even after soft-delete, because the delete endpoint preserves Storage
-- objects for published snapshot integrity.
create unique index idx_invitation_assets_storage_path
	on invitation_assets(bucket, storage_path);

-- For listing active (non-deleted) assets per invitation
create index idx_invitation_assets_invitation
	on invitation_assets(invitation_id)
	where deleted_at is null;

-- ============================================================================
-- 2. Row-Level Security
-- ============================================================================

alter table invitation_assets enable row level security;

-- Service-role full access for server-side repository/API operations.
-- API routes are the access gate; no direct authenticated table access.
create policy "service_role full access"
	on invitation_assets
	for all
	to service_role
	using (true)
	with check (true);

-- ============================================================================
-- 3. Storage bucket creation
--    Note: The bucket must also be created via the Supabase Management API
--    or dashboard. This SQL registers the bucket in the storage schema.
--    If the bucket already exists, this is a no-op.
-- ============================================================================

insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit)
values (
	'invitation-assets',
	'invitation-assets',
	true,               -- public reads (signed URLs deferred)
	false,
	10485760            -- 10 MB file size limit
)
on conflict (id) do nothing;

-- Public read access for storage objects
create policy "public read invitation assets"
	on storage.objects
	for select
	to public
	using (bucket_id = 'invitation-assets');

-- Service-role write access (uploads happen server-side via API routes)
create policy "service_role write invitation assets"
	on storage.objects
	for insert
	to service_role
	with check (bucket_id = 'invitation-assets');

create policy "service_role delete invitation assets"
	on storage.objects
	for delete
	to service_role
	using (bucket_id = 'invitation-assets');

commit;
