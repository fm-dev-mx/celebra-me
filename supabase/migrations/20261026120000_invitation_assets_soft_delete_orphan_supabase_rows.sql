begin;

-- Soft-delete 35 live invitation_assets rows that still name the pre-R2 'supabase' provider and
-- that no publication or draft uses. They exist only in Preview (uploads from 2026-06-09 to
-- 2026-08-04 on Preview copies of client invitations); Production has none, so there this
-- statement matches nothing. The rows are named by id, and the provider, live-state and
-- no-reference checks keep it a no-op for any row that no longer matches. The five managed rows
-- of an archived wedding definition that its publication still uses are deliberately left out.
-- Storage objects are not touched.
update public.invitation_assets a
set deleted_at = now(),
	updated_at = now()
where a.id in (
		'ba417856-16e7-4808-9e03-2c84d17c069d'::uuid,
		'fad93470-1c8d-45ef-90c4-fab7d19b7912'::uuid,
		'0b760f93-6e5d-4f5b-b6c5-e2d999551a24'::uuid,
		'1e4100b9-49bf-430b-8ce0-59a1f9df4a17'::uuid,
		'a1b640d8-7c3a-4a99-b947-cc3da7bed101'::uuid,
		'b6d30e2a-cbed-4eed-8335-710105cdaa52'::uuid,
		'd1049f89-961c-4d07-ad12-19cc50efd0cc'::uuid,
		'ff5f596c-422b-4bfc-8954-85733fb9f68f'::uuid,
		'0c146376-d90a-42fb-89c1-154808527ba2'::uuid,
		'869fb59d-96d3-4e42-9589-141e0bbc315e'::uuid,
		'c9e50184-6936-4177-9094-b789aeb9048b'::uuid,
		'03585b41-80ae-423a-9474-74a6684800b4'::uuid,
		'04136fc7-7de4-4576-bede-4132f42510ad'::uuid,
		'1052e1ff-90ae-4ecd-8f19-7b88956a4cf4'::uuid,
		'16dfa23e-44b7-45cb-b4bf-a2f151a5fde5'::uuid,
		'1affdc50-b20c-4d88-82b9-3892edd85d03'::uuid,
		'4c2f6354-44e5-4eb5-a212-e3eef433e747'::uuid,
		'51a3c0da-a663-49c6-847e-87e45910bcbe'::uuid,
		'5cdce858-dca6-458e-8529-4dbc4250dd37'::uuid,
		'5fcf6344-d9fe-462b-b17d-39455b2a52eb'::uuid,
		'6797e6be-b3b1-4ecd-8d0f-1364325dddfc'::uuid,
		'67bc00b2-e1af-4614-9deb-ff538153f8d6'::uuid,
		'6db9eb3a-3132-47d1-8186-40f7ea2c3c13'::uuid,
		'72ee9a9d-e326-4a6b-b7d0-c4aa4a014edf'::uuid,
		'8815c3d7-29d3-4364-98b9-05d370676539'::uuid,
		'a2f50cf1-1b56-4bc4-92ee-ed4152f152f9'::uuid,
		'b116b681-729e-4dc8-bb9c-9ab338be129d'::uuid,
		'c3b43ebd-cf02-4277-8552-06317e27bbd7'::uuid,
		'ce56f32c-405f-4ef5-bb48-6ce007f60172'::uuid,
		'd7fbccc2-07ea-4373-9dd5-f30d00cf1de8'::uuid,
		'de152be2-9e10-4d68-9633-69448b94d7b2'::uuid,
		'eab85b62-28da-4701-af78-0b224a0ae753'::uuid,
		'fa9651de-3891-485f-8bfd-4a54449d19d2'::uuid,
		'5a9dda61-b675-4b35-b5ed-552c09998461'::uuid,
		'707de417-7959-44af-a673-e4eff994d652'::uuid
	)
	and a.provider = 'supabase'
	and a.deleted_at is null
	and not exists (
		select 1
		from public.published_invitation_content p
		where strpos(p.content::text, a.id::text) > 0
	)
	and not exists (
		select 1
		from public.invitation_content_drafts d
		where strpos(d.content::text, a.id::text) > 0
	);

commit;
