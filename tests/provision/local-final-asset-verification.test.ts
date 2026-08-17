import { describe, expect, it } from '@jest/globals';
import {
	canReuseExistingLocalAsset,
	isAcceptableLocalFinalAssetRow,
	isCloudinaryDeliveryUrl,
	isLocalManagedDeliveryUrl,
	isLocalSupabaseDeliveryUrl,
} from '../../scripts/provision/local-final-asset-verification.ts';

const SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);
const SLUG = 'leslie-perez';
const KEY = 'photo-01';
const LOCAL_URL = `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/managed/${SLUG}/${KEY}.webp`;
const CLOUDINARY_URL = `https://res.cloudinary.com/demo/image/upload/v1/xv/${SLUG}/assets/${KEY}.webp`;

describe('local final asset verification helpers', () => {
	it('detects local Supabase delivery URLs', () => {
		expect(isLocalSupabaseDeliveryUrl(LOCAL_URL)).toBe(true);
		expect(isLocalSupabaseDeliveryUrl('http://localhost:54321/storage/v1/object/public/invitation-assets/x')).toBe(
			true,
		);
		expect(isLocalSupabaseDeliveryUrl(CLOUDINARY_URL)).toBe(false);
		expect(isLocalSupabaseDeliveryUrl('https://example.com/storage/v1/object/public/invitation-assets/x')).toBe(
			false,
		);
	});

	it('requires managed path for local managed delivery URLs', () => {
		expect(isLocalManagedDeliveryUrl(LOCAL_URL, { slug: SLUG, key: KEY })).toBe(true);
		expect(
			isLocalManagedDeliveryUrl(
				'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/other/path.webp',
				{ slug: SLUG, key: KEY },
			),
		).toBe(false);
		expect(isCloudinaryDeliveryUrl(CLOUDINARY_URL)).toBe(true);
	});

	it('accepts supabase local SSOT rows with matching sha', () => {
		expect(
			isAcceptableLocalFinalAssetRow({
				provider: 'supabase',
				secureUrl: LOCAL_URL,
				sha256: SHA,
				expectedSha256: SHA,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(true);
	});

	it('accepts cloudinary leftover rows', () => {
		expect(
			isAcceptableLocalFinalAssetRow({
				provider: 'cloudinary',
				secureUrl: CLOUDINARY_URL,
				sha256: SHA,
				expectedSha256: SHA,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(true);
	});

	it('rejects supabase row with Cloudinary URL', () => {
		expect(
			isAcceptableLocalFinalAssetRow({
				provider: 'supabase',
				secureUrl: CLOUDINARY_URL,
				sha256: SHA,
				expectedSha256: SHA,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(false);
	});

	it('rejects cloudinary row with local Storage URL', () => {
		expect(
			isAcceptableLocalFinalAssetRow({
				provider: 'cloudinary',
				secureUrl: LOCAL_URL,
				sha256: SHA,
				expectedSha256: SHA,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(false);
	});

	it('rejects sha mismatch', () => {
		expect(
			isAcceptableLocalFinalAssetRow({
				provider: 'supabase',
				secureUrl: LOCAL_URL,
				sha256: OTHER_SHA,
				expectedSha256: SHA,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(false);
	});

	it('rejects missing secure_url', () => {
		expect(
			isAcceptableLocalFinalAssetRow({
				provider: 'supabase',
				secureUrl: null,
				sha256: SHA,
				expectedSha256: SHA,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(false);
	});

	it('allows content-only reuse for identical supabase local assets', () => {
		expect(
			canReuseExistingLocalAsset({
				provider: 'supabase',
				secureUrl: LOCAL_URL,
				sha256: SHA,
				expectedSha256: SHA,
				alt: 'Hero',
				expectedAlt: 'Hero',
				mimeType: 'image/webp',
				expectedMimeType: 'image/webp',
				validationVersion: 1,
				expectedValidationVersion: 1,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(true);
	});

	it('allows content-only reuse for cloudinary leftovers', () => {
		expect(
			canReuseExistingLocalAsset({
				provider: 'cloudinary',
				secureUrl: CLOUDINARY_URL,
				sha256: SHA,
				expectedSha256: SHA,
				alt: 'Hero',
				expectedAlt: 'Hero',
				mimeType: 'image/webp',
				expectedMimeType: 'image/webp',
				validationVersion: 1,
				expectedValidationVersion: 1,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(true);
	});

	it('allows content-only reuse for legacy null provider with Cloudinary leftover', () => {
		expect(
			canReuseExistingLocalAsset({
				provider: null,
				secureUrl: CLOUDINARY_URL,
				sha256: SHA,
				expectedSha256: SHA,
				alt: 'Hero',
				expectedAlt: 'Hero',
				mimeType: 'image/webp',
				expectedMimeType: 'image/webp',
				validationVersion: 1,
				expectedValidationVersion: 1,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(true);
	});

	it('allows content-only reuse for legacy null provider with local Storage URL', () => {
		expect(
			canReuseExistingLocalAsset({
				provider: null,
				secureUrl: LOCAL_URL,
				sha256: SHA,
				expectedSha256: SHA,
				alt: 'Hero',
				expectedAlt: 'Hero',
				mimeType: 'image/webp',
				expectedMimeType: 'image/webp',
				validationVersion: 1,
				expectedValidationVersion: 1,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(true);
	});

	it('rejects content-only reuse on metadata mismatch', () => {
		expect(
			canReuseExistingLocalAsset({
				provider: 'supabase',
				secureUrl: LOCAL_URL,
				sha256: SHA,
				expectedSha256: SHA,
				alt: 'Wrong',
				expectedAlt: 'Hero',
				mimeType: 'image/webp',
				expectedMimeType: 'image/webp',
				validationVersion: 1,
				expectedValidationVersion: 1,
				slug: SLUG,
				key: KEY,
			}),
		).toBe(false);
	});
});
