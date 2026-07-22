import { describe, expect, it } from '@jest/globals';
import { computePackageHash, serializeInvitationPackage, type InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type { NormalizedInvitationRelease } from '../../scripts/provision/normalized-invitation-release.ts';
import { validatePackageData } from '../../scripts/provision/invitation-import-engine.ts';

const hash = 'a'.repeat(64);
const basePayload: Omit<InvitationPackageData, 'packageHash'> = {
	schemaVersion: '2.0.0', sourceHash: hash, metadataHash: hash, projectionHash: hash, assetManifestHash: hash,
	definitionCreatedAt: '2026-07-20T00:00:00.000Z', sourceSlug: 'test-invitation',
	invitation: { slug: 'test-invitation', title: 'Test', eventType: 'xv', baseDemoId: 'demo', themeId: 'theme', visualProfileId: 'profile', kind: 'client', clientName: 'Client', clientEmail: '', clientWhatsapp: '', photosReceived: true, snapshot: {} },
	draft: { status: 'draft', content: { hero: { title: 'Test' } } }, publishedContent: { content: { hero: { title: 'Test' } } }, event: { title: 'Test', eventType: 'xv', status: 'published' },
	assets: [
		{ key: 'portrait', displayName: 'Portrait', defaultAltText: 'Portrait', bucket: 'invitation-assets', storagePath: 'managed/test/portrait.webp', mimeType: 'image/webp', width: 800, height: 1200, fileSize: 1, validationVersion: 1, originalMimeType: 'image/jpeg', originalFileSize: 2, sha256: hash, dataBase64: 'AA==' },
		{ key: 'hero', displayName: 'Hero', defaultAltText: 'Hero', bucket: 'invitation-assets', storagePath: 'managed/test/hero.webp', mimeType: 'image/webp', width: 1200, height: 800, fileSize: 1, validationVersion: 1, originalMimeType: 'image/jpeg', originalFileSize: 2, sha256: hash, dataBase64: 'AA==' },
	],
};

describe('invitation package', () => {
	it('hashes the complete deterministic payload independent of asset order', () => {
		expect(computePackageHash(basePayload)).toBe(computePackageHash({ ...basePayload, assets: [...basePayload.assets].reverse() }));
		expect(computePackageHash(basePayload)).not.toBe(computePackageHash({ ...basePayload, invitation: { ...basePayload.invitation, title: 'Changed' } }));
	});

	it('uses the serialized package hash as the normalized release provenance identity', () => {
		const release: NormalizedInvitationRelease = {
			schemaVersion: '2.0.0', slug: 'test-invitation', definitionCreatedAt: '2026-07-20T00:00:00.000Z', sourceHash: hash, metadataHash: hash, projectionHash: hash, assetManifestHash: hash,
			metadata: { title: 'Test', eventType: 'xv', baseDemoId: 'demo', themeId: 'theme', visualProfileId: 'profile', clientName: 'Client', clientEmail: '', clientWhatsapp: '', photosReceived: true, snapshot: {} },
			draftContent: { hero: { type: 'uploaded', assetId: '__INVITATION_ASSET_KEY__:hero', src: '__STORAGE_URL__/__INVITATION_ASSET_KEY__:hero' } },
			publishedProjection: { hero: { type: 'uploaded', assetId: '__INVITATION_ASSET_KEY__:hero', src: '__STORAGE_URL__/__INVITATION_ASSET_KEY__:hero' } },
			assets: [{ key: 'hero', displayName: 'Hero', alt: 'Hero', bytes: new Uint8Array([0]), dataBase64: 'AA==', sha256: hash, mimeType: 'image/webp', width: 1, height: 1, fileSize: 1, validationVersion: 1, originalMimeType: 'image/jpeg', originalFileSize: 1 }],
		};
		const pkg = serializeInvitationPackage(release);
		expect(pkg.packageHash).toBe(computePackageHash(pkg));
		expect(pkg.sourceHash).toBe(release.sourceHash);
		expect(pkg.assets.every((asset) => !asset.storagePath.includes('127.0.0.1'))).toBe(true);
	});

	it('accepts an in-memory package only when every integrity hash is present and correct', () => {
		const valid = { ...basePayload, packageHash: computePackageHash(basePayload) };
		expect(validatePackageData(valid)).toEqual(valid);
		expect(() => validatePackageData({ ...valid, packageHash: 'f'.repeat(64) })).toThrow(/integrity verification/i);
	});
});
