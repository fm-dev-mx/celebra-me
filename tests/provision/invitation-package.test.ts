/**
 * Unit & Contract tests for scripts/provision/invitation-package.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
	computePackageHash,
	sanitizeStorageUrls,
	STORAGE_URL_PLACEHOLDER,
	type InvitationPackageData,
} from '../../scripts/provision/invitation-package';

describe('Invitation Package Exporter', () => {
	describe('computePackageHash', () => {
		it('produces identical deterministic package hash regardless of asset order', () => {
			const assetA = {
				displayName: 'Hero',
				defaultAltText: 'Hero image',
				bucket: 'invitation-assets',
				storagePath: 'invitations/inv-1/hero.webp',
				mimeType: 'image/webp',
				width: 1200,
				height: 800,
				fileSize: 50000,
				validationVersion: 1,
				originalMimeType: 'image/jpeg',
				originalFileSize: 200000,
				sha256: 'abc123hasha',
				dataBase64: 'AAAA',
			};

			const assetB = {
				displayName: 'Portrait',
				defaultAltText: 'Portrait image',
				bucket: 'invitation-assets',
				storagePath: 'invitations/inv-1/portrait.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 1200,
				fileSize: 40000,
				validationVersion: 1,
				originalMimeType: 'image/jpeg',
				originalFileSize: 150000,
				sha256: 'def456hashb',
				dataBase64: 'BBBB',
			};

			const basePayload: Omit<InvitationPackageData, 'packageHash'> = {
				schemaVersion: '1.0.0',
				createdAt: '2026-07-20T12:00:00.000Z',
				sourceSlug: 'test-invitation',
				invitation: {
					slug: 'test-invitation',
					title: 'Test Invitation',
					eventType: 'xv',
					baseDemoId: 'demo-xv-premiere-floral',
					themeId: 'premiere-floral',
					kind: 'client',
					clientName: 'Test Client',
					clientEmail: 'test@example.com',
					clientWhatsapp: '+525555555555',
					photosReceived: true,
					snapshot: { id: 'demo-xv-premiere-floral' },
				},
				draft: {
					status: 'draft',
					content: { hero: { name: 'Test' } },
				},
				publishedContent: null,
				event: null,
				assets: [assetA, assetB],
			};

			const hash1 = computePackageHash(basePayload);
			const hash2 = computePackageHash({
				...basePayload,
				assets: [assetB, assetA], // Reversed order
			});

			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(64);
		});

		it('produces identical package hash regardless of export createdAt timestamp', () => {
			const basePayload: Omit<InvitationPackageData, 'packageHash'> = {
				schemaVersion: '1.0.0',
				createdAt: '2026-07-20T12:00:00.000Z',
				sourceSlug: 'test-invitation',
				invitation: {
					slug: 'test-invitation',
					title: 'Test Invitation',
					eventType: 'xv',
					baseDemoId: 'demo-xv-premiere-floral',
					themeId: 'premiere-floral',
					kind: 'client',
					clientName: 'Test Client',
					clientEmail: 'test@example.com',
					clientWhatsapp: '+525555555555',
					photosReceived: true,
					snapshot: { id: 'demo-xv-premiere-floral' },
				},
				draft: { status: 'draft', content: { hero: { name: 'Test' } } },
				publishedContent: null,
				event: null,
				assets: [],
			};

			const hash1 = computePackageHash(basePayload);
			const hash2 = computePackageHash({
				...basePayload,
				createdAt: '2026-07-20T15:30:45.123Z', // Different export timestamp
			});

			expect(hash1).toBe(hash2);
		});

		it('produces different hash if any content property changes', () => {
			const basePayload: Omit<InvitationPackageData, 'packageHash'> = {
				schemaVersion: '1.0.0',
				createdAt: '2026-07-20T12:00:00.000Z',
				sourceSlug: 'test-invitation',
				invitation: {
					slug: 'test-invitation',
					title: 'Test Invitation',
					eventType: 'xv',
					baseDemoId: 'demo-xv-premiere-floral',
					themeId: 'premiere-floral',
					kind: 'client',
					clientName: 'Test Client',
					clientEmail: 'test@example.com',
					clientWhatsapp: '+525555555555',
					photosReceived: true,
					snapshot: {},
				},
				draft: { status: 'draft', content: { hero: { name: 'Original Name' } } },
				publishedContent: null,
				event: null,
				assets: [],
			};

			const hash1 = computePackageHash(basePayload);

			const modifiedPayload = {
				...basePayload,
				draft: { status: 'draft', content: { hero: { name: 'Modified Name' } } },
			};
			const hash2 = computePackageHash(modifiedPayload);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe('sanitizeStorageUrls', () => {
		it('replaces local and remote Supabase Storage URLs with __STORAGE_URL__', () => {
			const input = {
				hero: {
					src: 'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/invitations/123/hero.webp',
				},
				gallery: [
					{
						src: 'https://ineitkdkyrxqyressllp.supabase.co/storage/v1/object/public/invitation-assets/invitations/123/g1.webp',
					},
					{
						src: 'https://iwipdvisoyerfdytuhwi.supabase.co/storage/v1/object/public/invitation-assets/invitations/123/g2.webp',
					},
				],
				title: 'Clean Text',
			};

			const sanitized = sanitizeStorageUrls(input) as typeof input;

			expect(sanitized.hero.src).toBe(`${STORAGE_URL_PLACEHOLDER}/invitations/123/hero.webp`);
			expect(sanitized.gallery[0].src).toBe(
				`${STORAGE_URL_PLACEHOLDER}/invitations/123/g1.webp`,
			);
			expect(sanitized.gallery[1].src).toBe(
				`${STORAGE_URL_PLACEHOLDER}/invitations/123/g2.webp`,
			);
			expect(sanitized.title).toBe('Clean Text');
		});
	});
});
