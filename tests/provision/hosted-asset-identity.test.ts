import { describe, expect, it } from '@jest/globals';
import type { InvitationPackageAsset } from '../../scripts/provision/invitation-package.ts';
import {
	selectHostedAssetIdentityRow,
	resolveHostedUploadedAssetSrc,
	rewriteUploadedDeliverySrcs,
	type HostedAssetIdentityRow,
} from '../../scripts/provision/hosted-asset-identity.ts';

const familyAsset: InvitationPackageAsset = {
	key: 'family',
	displayName: 'Alba Rosa — familia',
	defaultAltText: 'Alba Rosa junto a su familia bajo un arco',
	bucket: 'invitation-assets',
	storagePath: 'managed/alba-rosa-quinonez/family.webp',
	mimeType: 'image/webp',
	width: 1600,
	height: 1200,
	fileSize: 80000,
	validationVersion: 1,
	originalMimeType: 'image/jpeg',
	originalFileSize: 240000,
	sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	dataBase64: 'mock',
};
const definitionSlug = 'alba-rosa-quinonez';
const R2_KEY = `invitations/cumple/${definitionSlug}/family-${familyAsset.sha256}.webp`;
const r2Asset: InvitationPackageAsset = {
	...familyAsset,
	provider: 'r2',
	providerPublicId: R2_KEY,
	secureUrl: `https://media-staging.celebra-me.com/${R2_KEY}`,
};

const liveFamilyRow: HostedAssetIdentityRow = {
	id: '7bce748d-8c86-40e3-b28e-0b5523640034',
	display_name: familyAsset.displayName,
	storage_path: familyAsset.storagePath,
	bucket: familyAsset.bucket,
	deleted_at: null,
	managed_by_definition_slug: definitionSlug,
	managed_source_key: familyAsset.key,
};

describe('hosted-asset-identity module', () => {
	it('selectHostedAssetIdentityRow matches live row by key and definition slug', () => {
		const match = selectHostedAssetIdentityRow({
			asset: familyAsset,
			rows: [liveFamilyRow],
			definitionSlug,
		});
		expect(match?.id).toBe(liveFamilyRow.id);
	});

	it('resolveHostedUploadedAssetSrc returns persisted secureUrl for R2', () => {
		const persisted = `https://media.celebra-me.com/${R2_KEY}`;
		const src = resolveHostedUploadedAssetSrc(
			r2Asset,
			{ ...liveFamilyRow, secure_url: persisted },
			'https://supabase.co/storage',
		);
		expect(src).toBe(persisted);
	});

	it('rewriteUploadedDeliverySrcs preserves unmapped values and rewrites uploaded types', () => {
		const assetId = '7bce748d-8c86-40e3-b28e-0b5523640034';
		const rewritten = rewriteUploadedDeliverySrcs(
			{ hero: { type: 'uploaded', assetId, src: 'old' }, text: 'hello' },
			{ hero: { type: 'uploaded', assetId, src: 'new-src' } },
		) as Record<string, unknown>;
		expect(rewritten).toEqual({
			hero: { type: 'uploaded', assetId, src: 'new-src' },
			text: 'hello',
		});
	});
});
