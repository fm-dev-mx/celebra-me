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

	it('resolves r2 assets from secure_url', () => {
		expect(
			resolveAssetDeliveryUrl({
				provider: 'r2',
				bucket: 'invitation-assets',
				storagePath: 'invitations/xv/abril/hero-abc.webp',
				secureUrl: 'https://media.celebra-me.com/invitations/xv/abril/hero-abc.webp',
			}),
		).toBe('https://media.celebra-me.com/invitations/xv/abril/hero-abc.webp');
	});

	it('throws when an r2 asset lacks secure_url instead of deriving a Storage URL', () => {
		expect(() =>
			resolveAssetDeliveryUrl({
				provider: 'r2',
				bucket: 'invitation-assets',
				storagePath: 'invitations/xv/abril/hero-abc.webp',
			}),
		).toThrow(/R2 asset is missing secure_url/);
	});

	it('rejects the retired cloudinary provider', () => {
		expect(() =>
			resolveAssetDeliveryUrl({
				provider: 'cloudinary',
				bucket: 'invitation-assets',
				storagePath: 'managed/abril/hero.jpg',
				secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg',
			}),
		).toThrow(/Unsupported asset provider "cloudinary"/);
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

	it('does not let a supabase-derived url override a frozen r2 src', () => {
		const frozen =
			'https://media.celebra-me.com/invitations/xv/abril/thank-you-confetti-abc.webp';
		const preferred = preferUploadedDeliverySrc({
			asset: {
				provider: 'r2',
				bucket: 'invitation-assets',
				storagePath: 'managed/abril/thank-you-confetti.webp',
				secureUrl: frozen,
			},
			frozenSrc: frozen,
		});

		expect(preferred).toBe(frozen);
		expect(preferred).toContain('media.celebra-me.com');
		expect(preferred).not.toContain('127.0.0.1:54321');
	});
});
