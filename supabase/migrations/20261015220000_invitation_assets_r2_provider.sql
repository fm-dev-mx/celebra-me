begin;

-- Admit Cloudflare R2 as an invitation asset provider beside Supabase Storage and Cloudinary.
-- R2 rows carry the same remote identity fields as Cloudinary rows (object key and HTTPS URL).
-- Both checks only widen, so every existing row still satisfies them. No asset bytes, URLs,
-- invitation content, or existing rows are changed by this expansion.
alter table public.invitation_assets
	drop constraint invitation_assets_provider_valid,
	add constraint invitation_assets_provider_valid
		check (provider in ('supabase', 'cloudinary', 'r2')) not valid,
	drop constraint invitation_assets_cloudinary_fields_complete,
	add constraint invitation_assets_cloudinary_fields_complete
		check (
			provider = 'supabase'
			or (
				provider in ('cloudinary', 'r2')
				and provider_public_id is not null
				and secure_url is not null
			)
		) not valid;

comment on column public.invitation_assets.provider is
	'Storage provider backing the asset (supabase, cloudinary or r2).';

comment on column public.invitation_assets.provider_public_id is
	'Immutable provider asset identifier: Cloudinary public ID or R2 object key.';

commit;
