begin;

-- Retire 'cloudinary' as an invitation asset provider: invitation media lives in Supabase Storage
-- or Cloudflare R2. The remote identity check keeps the same rule for R2 rows (object key and
-- HTTPS URL) under a provider-neutral name. Abort instead of rewriting rows if any Cloudinary
-- row, deleted or not, is still present; no asset bytes, URLs or invitation content change.
do $$
declare
	cloudinary_rows integer;
begin
	select count(*) into cloudinary_rows
	from public.invitation_assets
	where provider = 'cloudinary';

	if cloudinary_rows > 0 then
		raise exception
			'invitation_assets still has % cloudinary row(s); migrate them to r2 before this contract',
			cloudinary_rows;
	end if;
end;
$$;

alter table public.invitation_assets
	drop constraint invitation_assets_provider_valid,
	add constraint invitation_assets_provider_valid
		check (provider in ('supabase', 'r2')),
	drop constraint invitation_assets_cloudinary_fields_complete,
	add constraint invitation_assets_remote_fields_complete
		check (
			provider = 'supabase'
			or (
				provider = 'r2'
				and provider_public_id is not null
				and secure_url is not null
			)
		);

comment on column public.invitation_assets.provider is
	'Storage provider backing the asset (supabase or r2).';

comment on column public.invitation_assets.provider_public_id is
	'Immutable provider asset identifier: the R2 object key.';

commit;
