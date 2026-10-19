begin;

-- Retire 'cloudinary' as an invitation asset provider: invitation media lives in Supabase Storage
-- or Cloudflare R2. Soft-deleted rows (deleted_at set) are history and may keep the retired
-- provider; every live row must use supabase or r2. The remote identity check keeps the same rule
-- for live R2 rows (object key and HTTPS URL) under a provider-neutral name. Abort instead of
-- rewriting rows if any live Cloudinary row is still present; no rows, asset bytes, URLs or
-- invitation content change.
do $$
declare
	live_cloudinary_rows integer;
begin
	select count(*) into live_cloudinary_rows
	from public.invitation_assets
	where provider = 'cloudinary'
		and deleted_at is null;

	if live_cloudinary_rows > 0 then
		raise exception
			'invitation_assets still has % live cloudinary row(s); migrate or delete them before this contract',
			live_cloudinary_rows;
	end if;
end;
$$;

alter table public.invitation_assets
	drop constraint invitation_assets_provider_valid,
	add constraint invitation_assets_provider_valid
		check (provider in ('supabase', 'r2') or deleted_at is not null),
	drop constraint invitation_assets_cloudinary_fields_complete,
	add constraint invitation_assets_remote_fields_complete
		check (
			deleted_at is not null
			or provider = 'supabase'
			or (
				provider = 'r2'
				and provider_public_id is not null
				and secure_url is not null
			)
		);

comment on column public.invitation_assets.provider is
	'Storage provider backing the asset (supabase or r2). Soft-deleted rows may keep a retired provider.';

comment on column public.invitation_assets.provider_public_id is
	'Immutable provider asset identifier: the R2 object key.';

commit;
