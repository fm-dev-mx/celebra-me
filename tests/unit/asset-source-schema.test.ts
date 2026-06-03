import { AssetSchema } from '@/lib/schemas/content/shared.schema';

describe('AssetSchema (published content)', () => {
	const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

	it('accepts {type:uploaded, assetId, src} for published refs (preserves src)', () => {
		const result = AssetSchema.safeParse({
			type: 'uploaded',
			assetId: VALID_UUID,
			src: 'https://cdn.test/image.webp',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toMatchObject({
				type: 'uploaded',
				assetId: VALID_UUID,
				src: 'https://cdn.test/image.webp',
			});
		}
	});

	it('accepts {type:uploaded, assetId} without src for draft refs', () => {
		const result = AssetSchema.safeParse({
			type: 'uploaded',
			assetId: VALID_UUID,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toMatchObject({
				type: 'uploaded',
				assetId: VALID_UUID,
			});
		}
	});

	it('rejects {type:uploaded} with invalid assetId', () => {
		const result = AssetSchema.safeParse({
			type: 'uploaded',
			assetId: 'not-a-uuid',
		});
		expect(result.success).toBe(false);
	});

	it('accepts {type:internal, key} unchanged', () => {
		const result = AssetSchema.safeParse({
			type: 'internal',
			key: 'hero',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ type: 'internal', key: 'hero' });
		}
	});

	it('accepts {type:external, src} with HTTPS URL', () => {
		const result = AssetSchema.safeParse({
			type: 'external',
			src: 'https://cdn.test/photo.jpg',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ type: 'external', src: 'https://cdn.test/photo.jpg' });
		}
	});

	it('normalizes plain registry key string to {type:internal}', () => {
		const result = AssetSchema.safeParse('hero');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ type: 'internal', key: 'hero' });
		}
	});

	it('normalizes https URL string to {type:external}', () => {
		const result = AssetSchema.safeParse('https://cdn.test/photo.jpg');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ type: 'external', src: 'https://cdn.test/photo.jpg' });
		}
	});

	it('normalizes /-prefixed path to {type:external}', () => {
		const result = AssetSchema.safeParse('/uploads/photo.jpg');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ type: 'external', src: '/uploads/photo.jpg' });
		}
	});

	it('maintains backward compat: internal and external still work', () => {
		const internal = AssetSchema.safeParse({ type: 'internal', key: 'gallery01' });
		const external = AssetSchema.safeParse({ type: 'external', src: 'https://cdn.test/x.jpg' });
		expect(internal.success).toBe(true);
		expect(external.success).toBe(true);
	});
});
