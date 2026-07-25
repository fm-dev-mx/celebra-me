-- Migration: Add provider-neutral fields to invitation_assets for Cloudinary integration.
--
-- Preserves existing Supabase Storage behavior and columns (bucket, storage_path).
-- Adds neutral fields for multi-provider support: provider, provider_public_id,
-- provider_version, secure_url, sha256, and provider_metadata.

begin;

alter table public.invitation_assets
	add column if not exists provider text not null default 'supabase',
	add column if not exists provider_public_id text,
	add column if not exists provider_version text,
	add column if not exists secure_url text,
	add column if not exists sha256 text,
	add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

-- Backfill existing rows as Supabase assets
update public.invitation_assets
set provider_public_id = storage_path
where provider_public_id is null;

-- Reconcile constraints if re-run
alter table public.invitation_assets
	drop constraint if exists invitation_assets_provider_valid,
	drop constraint if exists invitation_assets_cloudinary_fields_complete;

alter table public.invitation_assets
	add constraint invitation_assets_provider_valid
		check (provider in ('supabase', 'cloudinary')) not valid,
	add constraint invitation_assets_cloudinary_fields_complete
		check (
			provider = 'supabase'
			or (
				provider = 'cloudinary'
				and provider_public_id is not null
				and secure_url is not null
			)
		) not valid;

comment on column public.invitation_assets.provider is
	'Storage provider backing the asset (supabase or cloudinary).';

comment on column public.invitation_assets.provider_public_id is
	'Immutable provider asset identifier or Cloudinary public ID.';

comment on column public.invitation_assets.secure_url is
	'Canonical HTTPS secure URL for public asset delivery.';

comment on column public.invitation_assets.sha256 is
	'Hex-encoded SHA-256 checksum of the original canonical binary.';

commit;
