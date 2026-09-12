import {
	inspectHostedImageInventory,
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
	it('finds legacy, cross-environment, and missing published assets without including audio', () => {
		const findings = inspectHostedImageInventory(invitations, 'preview');
		expect(findings).toHaveLength(3);
		expect(findings.find((item) => item.assetId === 'legacy')).toMatchObject({
			referenced: true,
			namespace: 'legacy',
			targetPublicId: 'preview/xv/valentina-hernandez/assets/hero-' + sha256.slice(0, 12),
			reasons: ['image namespace is legacy'],
		});
		expect(findings.find((item) => item.assetId === 'wrong')).toMatchObject({
			referenced: false,
			namespace: 'production',
			reasons: ['image namespace is production'],
		});
		expect(findings.find((item) => item.assetId === 'missing')).toMatchObject({
			referenced: true,
			namespace: 'missing',
			reasons: ['content reference has no active asset row'],
		});
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
		});
		expect(findings.find((item) => item.assetId === 'legacy')).toMatchObject({
			referenced: false,
			draftReferenced: true,
			namespace: 'legacy',
		});
	});
	it('accepts a namespaced referenced image', () => {
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
		expect(inspectHostedImageInventory(published, 'preview')).toMatchObject([
			{ reasons: [], referenced: true, namespace: 'preview' },
		]);
	});
});
