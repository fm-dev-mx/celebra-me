begin;

-- Hard-delete the soft-deleted invitation_assets rows that still name the retired 'cloudinary'
-- provider. 20261019180000 already rejects live Cloudinary rows, so these rows can never be
-- restored; nothing references them by foreign key, and no draft, publication or managed profile
-- points at them. Only history tables (publication idempotency results, managed release
-- provenance) keep their ids as JSON text, which nothing joins back to this table. Asset files in
-- the Cloudinary account are not touched. Live rows and every other provider stay unchanged.
delete from public.invitation_assets
where provider = 'cloudinary'
	and deleted_at is not null;

commit;
