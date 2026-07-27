/**
 * asset-delivery.test.ts — Provider-aware delivery URL resolution
 */

const mockGetSupabaseUrl = jest.fn();

jest.mock('@/lib/server/supabase-credentials', () => ({
	getSupabaseUrl: mockGetSupabaseUrl,
}));

import {
	preferUploadedDeliverySrc,
	resolveAssetDeliveryUrl,
} from '@/lib/intake/services/asset-delivery';

describe('resolveAssetDeliveryUrl', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		mockGetSupabaseUrl.mockReturnValue('http://127.0.0.1:54321');
		delete process.env.CLOUDINARY_CLOUD_NAME;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it('resolves supabase assets from bucket + storage path', () => {
		expect(
			resolveAssetDeliveryUrl({
				provider: 'supabase',
				bucket: 'invitation-assets',
				storagePath: 'managed/abril/hero.webp',
			}),
		).toBe(
			'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/managed/abril/hero.webp',
		);
	});

	it('resolves cloudinary assets from secure_url when present', () => {
		expect(
			resolveAssetDeliveryUrl({
				provider: 'cloudinary',
				bucket: 'invitation-assets',
				storagePath: 'xv/abril/assets/hero',
				secureUrl:
					'https://res.cloudinary.com/demo/image/upload/v1/xv/abril/assets/hero.webp',
			}),
		).toBe('https://res.cloudinary.com/demo/image/upload/v1/xv/abril/assets/hero.webp');
	});

	it('throws for an unsupported provider', () => {
		expect(() =>
			resolveAssetDeliveryUrl({
				provider: 's3',
				bucket: 'invitation-assets',
				storagePath: 'managed/abril/hero.webp',
			}),
		).toThrow(/Unsupported asset provider "s3"/);
	});
});

describe('preferUploadedDeliverySrc', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		mockGetSupabaseUrl.mockReturnValue('http://127.0.0.1:54321');
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it('does not let a supabase-derived url override a frozen cloudinary src', () => {
		const frozen =
			'https://res.cloudinary.com/demo/image/upload/v1/xv/abril/assets/thank-you-confetti.webp';
		const preferred = preferUploadedDeliverySrc({
			asset: {
				provider: 'cloudinary',
				bucket: 'invitation-assets',
				storagePath: 'managed/abril/thank-you-confetti.webp',
				secureUrl: frozen,
			},
			frozenSrc: frozen,
		});

		expect(preferred).toBe(frozen);
		expect(preferred).toContain('res.cloudinary.com');
		expect(preferred).not.toContain('127.0.0.1:54321');
	});
});
