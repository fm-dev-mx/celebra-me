import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { verifyPublishedInvitation } from '../../scripts/invitation/verify-published-images.ts';

describe('published image verification', () => {
	async function imageFixture() {
		const bytes = await sharp({
			create: { width: 3, height: 2, channels: 3, background: '#fff' },
		})
			.webp()
			.toBuffer();
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		return { bytes, sha256 };
	}

	it('classifies a valid referenced binary as healthy', async () => {
		const { bytes, sha256 } = await imageFixture();
		const download = jest.fn(async () => ({
			ok: true,
			status: 200,
			url: 'https://res.cloudinary.com/demo/image/upload/v1/production/xv/example/assets/hero.webp',
			headers: new Headers({ 'content-type': 'image/webp' }),
			arrayBuffer: async () => Uint8Array.from(bytes).buffer,
		})) as unknown as typeof fetch;
		const rows = await verifyPublishedInvitation(
			{
				eventType: 'xv',
				slug: 'example',
				content: { hero: { image: { type: 'uploaded', assetId: 'asset-1' } } },
				assets: [
					{
						id: 'asset-1',
						key: 'hero',
						sha256,
						mimeType: 'image/webp',
						width: 3,
						height: 2,
						url: 'https://res.cloudinary.com/demo/image/upload/v1/production/xv/example/assets/hero.webp',
					},
				],
			},
			[{ key: 'hero', sha256, mimeType: 'image/webp', width: 3, height: 2 }],
			download,
		);
		expect(rows).toEqual([expect.objectContaining({ classification: 'HEALTHY', reasons: [] })]);
	});

	it.each([
		[404, 'MISSING'],
		[200, 'METADATA_DRIFT'],
	] as const)('fails closed for HTTP %s', async (status, classification) => {
		const { sha256 } = await imageFixture();
		const download = jest.fn(async () =>
			status === 404
				? new Response(null, { status })
				: new Response('not an image', {
						status,
						headers: { 'content-type': 'text/plain' },
					}),
		) as unknown as typeof fetch;
		const [row] = await verifyPublishedInvitation(
			{
				eventType: 'xv',
				slug: 'broken',
				content: { hero: { image: { type: 'uploaded', assetId: 'asset-1' } } },
				assets: [
					{
						id: 'asset-1',
						key: 'hero',
						sha256,
						mimeType: 'image/webp',
						width: 3,
						height: 2,
						url: 'https://res.cloudinary.com/demo/image/upload/v1/production/xv/broken/assets/hero.webp',
					},
				],
			},
			null,
			download,
		);
		expect(row?.classification).toBe(classification);
	});

	it('reports missing rows, orphan rows, duplicates, and redacts URLs', async () => {
		const download = jest.fn(
			async () => new Response(null, { status: 404 }),
		) as unknown as typeof fetch;
		const rows = await verifyPublishedInvitation(
			{
				eventType: 'boda',
				slug: 'example',
				content: { hero: { image: { type: 'uploaded', assetId: 'missing' } } },
				assets: [
					{
						id: 'orphan',
						key: 'hero',
						sha256: 'a',
						mimeType: 'image/webp',
						width: 1,
						height: 1,
						url: 'https://res.cloudinary.com/demo/image/upload/v1/production/boda/example/hero.webp?token=secret',
					},
					{
						id: 'orphan',
						key: 'hero',
						sha256: 'a',
						mimeType: 'image/webp',
						width: 1,
						height: 1,
						url: 'https://res.cloudinary.com/demo/image/upload/v1/production/boda/example/hero.webp?token=secret',
					},
				],
			},
			null,
			download,
		);
		expect(
			rows.some((row) => row.assetKey === 'missing' && row.classification === 'MISSING'),
		).toBe(true);
		expect(JSON.stringify(rows)).not.toContain('token=secret');
	});

	it('blocks a stale frozen content URL even when the active binary is healthy', async () => {
		const { bytes, sha256 } = await imageFixture();
		const activeUrl =
			'https://res.cloudinary.com/demo/image/upload/v1/boda/example/assets/hero.webp';
		const download = jest.fn(async (input: URL | RequestInfo) => {
			const requested = String(input);
			if (requested.includes('/production/')) return new Response(null, { status: 404 });
			return {
				ok: true,
				status: 200,
				url: activeUrl,
				headers: new Headers({ 'content-type': 'image/webp' }),
				arrayBuffer: async () => Uint8Array.from(bytes).buffer,
			} as Response;
		}) as unknown as typeof fetch;
		const [row] = await verifyPublishedInvitation(
			{
				eventType: 'boda',
				slug: 'example',
				content: {
					hero: {
						image: {
							type: 'uploaded',
							assetId: 'asset-1',
							src: 'https://res.cloudinary.com/demo/image/upload/v1/production/boda/example/assets/hero.webp',
						},
					},
				},
				assets: [
					{
						id: 'asset-1',
						key: 'hero',
						sha256,
						mimeType: 'image/webp',
						width: 3,
						height: 2,
						url: activeUrl,
					},
				],
			},
			null,
			download,
		);
		expect(row).toMatchObject({ classification: 'MISSING' });
		expect(row?.reasons).toContain('published content URL: HTTP 404');
	});
});
