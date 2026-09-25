import {
	buildHostedImageInventoryReport,
	buildHostedImageInventoryQuery,
	formatHostedImageInventoryReport,
	hostedImageInventoryExitCode,
	inspectHostedImageInventory,
	redactDiagnostic,
	type InventoryInvitation,
} from '../../scripts/invitation/hosted-image-inventory.ts';

const sha256 = 'a'.repeat(64);
const invitations: InventoryInvitation[] = [
	{
		slug: 'valentina-hernandez',
		eventType: 'xv',
		content: {
			hero: { image: { type: 'uploaded', assetId: 'legacy' } },
			gallery: { image: { type: 'uploaded', assetId: 'missing' } },
		},
		assets: [
			{
				id: 'legacy',
				key: 'hero',
				provider: 'cloudinary',
				publicId: 'xv/valentina-hernandez/assets/hero-abc',
				sha256,
				mimeType: 'image/webp',
			},
			{
				id: 'wrong',
				key: 'gallery',
				provider: 'cloudinary',
				publicId: 'production/xv/valentina-hernandez/assets/gallery-abc',
				sha256,
				mimeType: 'image/webp',
			},
			{
				id: 'audio',
				key: 'music',
				provider: 'cloudinary',
				publicId: 'xv/valentina-hernandez/assets/music-abc',
				sha256,
				mimeType: 'audio/mpeg',
			},
		],
	},
];

describe('published invitation image inventory', () => {
	it('queries active client invitations from the database and separates prior publication rows', () => {
		const query = buildHostedImageInventoryQuery();
		expect(query).toContain('from public.invitations i');
		expect(query).toContain("i.archived_at is null and i.kind = 'client'");
		expect(query).toContain('from public.invitation_content_drafts');
		expect(query).toContain('history.id is distinct from (select current.id');
		expect(query).toContain('coalesce((select json_agg(json_build_object(');
		expect(query).not.toContain('listInvitationDefinitions');
	});

	it('separates migration candidates and unused rows from missing published references', () => {
		const findings = inspectHostedImageInventory(invitations, 'preview');
		expect(findings).toHaveLength(3);
		expect(findings.find((item) => item.assetId === 'legacy')).toMatchObject({
			kind: 'ACTIVE_ASSET',
			referenced: true,
			namespace: 'legacy',
			status: 'REVIEW',
			migration: 'MIGRATION_CANDIDATE',
			delivery: 'NOT_CHECKED',
			targetPublicId: 'preview/xv/valentina-hernandez/assets/hero-' + sha256.slice(0, 12),
			reasons: ['namespace legacy: candidata de migración segura'],
		});
		expect(findings.find((item) => item.assetId === 'wrong')).toMatchObject({
			referenced: false,
			usage: { unreferenced: true },
			namespace: 'production',
			status: 'REVIEW',
			migration: 'BLOCKED',
			reasons: expect.arrayContaining(['namespace de imagen: production']),
		});
		expect(findings.find((item) => item.assetId === 'missing')).toMatchObject({
			kind: 'MISSING_REFERENCE',
			referenced: true,
			status: 'BLOCKED',
			namespace: 'missing',
			reasons: ['referencia de contenido sin fila activa de asset'],
		});
		expect(hostedImageInventoryExitCode('REVIEW')).toBe(0);
		expect(hostedImageInventoryExitCode('BLOCKED')).toBe(1);
	});

	it('counts draft references and reports a shared missing asset once', () => {
		const draft: InventoryInvitation[] = [
			{
				slug: 'example',
				eventType: 'xv',
				content: { hero: { image: { type: 'uploaded', assetId: 'missing' } } },
				draftContent: {
					hero: { image: { type: 'uploaded', assetId: 'missing' } },
					family: { image: { type: 'uploaded', assetId: 'legacy' } },
				},
				assets: [
					{
						id: 'legacy',
						key: 'family',
						provider: 'cloudinary',
						publicId: 'xv/example/assets/family-abc',
						sha256,
						mimeType: 'image/webp',
					},
				],
			},
		];
		const findings = inspectHostedImageInventory(draft, 'preview');
		expect(findings).toHaveLength(2);
		expect(findings.find((item) => item.assetId === 'missing')).toMatchObject({
			referenced: true,
			draftReferenced: true,
			status: 'BLOCKED',
		});
		expect(findings.find((item) => item.assetId === 'legacy')).toMatchObject({
			referenced: false,
			draftReferenced: true,
			usage: { published: false, draft: true, historical: false, unreferenced: false },
			namespace: 'legacy',
			status: 'REVIEW',
			migration: 'MIGRATION_CANDIDATE',
		});
	});

	it('separates draft and historical usage for unregistered client invitations', () => {
		const unpublished: InventoryInvitation[] = [
			{
				slug: 'unmanaged-client',
				eventType: 'xv',
				content: {},
				draftContent: { hero: { image: { type: 'uploaded', assetId: 'draft-hero' } } },
				historicalContents: [
					{ gallery: { image: { type: 'uploaded', assetId: 'historical-gallery' } } },
				],
				assets: [
					{
						id: 'draft-hero',
						key: 'hero',
						provider: 'cloudinary',
						publicId: 'xv/unmanaged-client/assets/hero-abc',
						sha256,
						mimeType: 'image/webp',
					},
					{
						id: 'historical-gallery',
						key: 'gallery',
						provider: 'cloudinary',
						publicId: 'xv/unmanaged-client/assets/gallery-abc',
						sha256,
						mimeType: 'image/webp',
					},
				],
			},
		];
		const findings = inspectHostedImageInventory(unpublished, 'preview');
		expect(findings).toHaveLength(2);
		expect(findings.find((item) => item.assetId === 'draft-hero')).toMatchObject({
			usage: { published: false, draft: true, historical: false, unreferenced: false },
		});
		expect(findings.find((item) => item.assetId === 'historical-gallery')).toMatchObject({
			usage: { published: false, draft: false, historical: true, unreferenced: false },
		});
	});

	it('marks a namespaced referenced image current without claiming delivery verification', () => {
		const published: InventoryInvitation[] = [
			{
				slug: 'example',
				eventType: 'xv',
				content: { hero: { image: { type: 'uploaded', assetId: 'hero' } } },
				assets: [
					{
						id: 'hero',
						key: 'hero',
						provider: 'cloudinary',
						publicId: 'preview/xv/example/assets/hero-abc',
						sha256,
						mimeType: 'image/webp',
					},
				],
			},
		];
		const report = buildHostedImageInventoryReport(published, 'preview');
		expect(report).toMatchObject({
			delivery: 'NOT_CHECKED',
			status: 'CURRENT',
			summary: { current: 1, blocked: 0, review: 0 },
		});
		expect(report.rows).toMatchObject([
			{ reasons: [], referenced: true, namespace: 'preview', status: 'CURRENT' },
		]);
	});

	it('blocks a referenced image whose MIME metadata is missing', () => {
		const referenced: InventoryInvitation[] = [
			{
				slug: 'example',
				eventType: 'xv',
				content: { hero: { image: { type: 'uploaded', assetId: 'hero' } } },
				assets: [
					{
						id: 'hero',
						key: 'hero',
						provider: 'cloudinary',
						publicId: 'preview/xv/example/assets/hero-abc',
						sha256,
						mimeType: null,
					},
				],
			},
		];
		const row = inspectHostedImageInventory(referenced, 'preview')[0];
		expect(row).toMatchObject({
			status: 'BLOCKED',
			migration: 'BLOCKED',
			delivery: 'NOT_CHECKED',
		});
		expect(row.reasons).toContain('MIME faltante o asset que no es imagen');
	});

	it('keeps unused metadata problems in review instead of calling them delivery failures', () => {
		const unused: InventoryInvitation[] = [
			{
				slug: 'example',
				eventType: 'xv',
				content: {},
				assets: [
					{
						id: 'unreferenced',
						key: null,
						provider: 'cloudinary',
						publicId: 'preview/xv/example/assets/unknown',
						sha256: null,
						mimeType: null,
					},
				],
			},
		];
		const report = buildHostedImageInventoryReport(unused, 'preview');
		expect(report.status).toBe('REVIEW');
		expect(report.summary).toMatchObject({ blocked: 0, review: 1, unreferenced: 1 });
		expect(report.findings[0]).toMatchObject({
			usage: { unreferenced: true },
			delivery: 'NOT_CHECKED',
			status: 'REVIEW',
		});
		expect(hostedImageInventoryExitCode(report.status)).toBe(0);
	});

	it('blocks duplicate active identities used by published content', () => {
		const duplicate: InventoryInvitation[] = [
			{
				slug: 'example',
				eventType: 'xv',
				content: { hero: { image: { type: 'uploaded', assetId: 'hero' } } },
				assets: [
					{
						id: 'hero',
						key: 'hero',
						provider: 'cloudinary',
						publicId: 'preview/xv/example/assets/hero-abc',
						sha256,
						mimeType: 'image/webp',
					},
					{
						id: 'hero',
						key: 'hero-copy',
						provider: 'cloudinary',
						publicId: 'preview/xv/example/assets/hero-copy-abc',
						sha256,
						mimeType: 'image/webp',
					},
				],
			},
		];
		const rows = inspectHostedImageInventory(duplicate, 'preview');
		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row.status === 'BLOCKED')).toBe(true);
		expect(
			rows.every((row) =>
				row.reasons.includes('identidad o clave duplicada entre assets activos'),
			),
		).toBe(true);
	});

	it('keeps text and JSON classifications aligned and redacts URLs and credentials', () => {
		const report = buildHostedImageInventoryReport(
			[
				{
					slug: 'example',
					eventType: 'xv',
					content: { hero: { image: { type: 'uploaded', assetId: 'hero' } } },
					assets: [
						{
							id: 'hero',
							key: 'hero',
							provider: 'cloudinary',
							publicId: 'https://res.cloudinary.com/private/image/upload/hero.webp',
							sha256,
							mimeType: 'image/webp',
						},
					],
				},
			],
			'preview',
		);
		const json = JSON.stringify(report);
		const text = formatHostedImageInventoryReport(report);
		expect(json).toContain('"delivery":"NOT_CHECKED"');
		expect(text).toContain('entrega HTTP/MIME/hash: NOT_CHECKED');
		expect(text).toContain(report.findings[0].status);
		expect(json).toContain('[URL redactada]');
		expect(json).not.toContain('https://res.cloudinary.com/private');
		expect(
			redactDiagnostic(
				'failed postgres://user:password@db.example.test/x https://host.test/path',
			),
		).not.toMatch(/password@|https:\/\/host\.test/);
	});
});
