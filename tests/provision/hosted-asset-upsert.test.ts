/**
 * Hosted invitation_assets upsert: conflict on id, immutable storage paths.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InvitationPackageAsset } from '../../scripts/provision/invitation-package.ts';
import {
	assertHostedAssetUpsertApplied,
	buildHostedAssetUpsertSql,
	resolveHostedUploadedAssetSrc,
	rewriteUploadedDeliverySrcs,
	selectHostedAssetIdentityRow,
	type HostedAssetIdentityRow,
} from '../../scripts/provision/invitation-import-engine.ts';

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

const engineSource = readFileSync(
	resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
	'utf8',
);

const sql = buildHostedAssetUpsertSql({
	assetId: '7bce748d-8c86-40e3-b28e-0b5523640034',
	targetInvitationId: '28110aef-078d-46bd-857c-893e10e11bc1',
	asset: {
		...familyAsset,
		provider: 'cloudinary',
		providerPublicId: 'preview/cumple/alba-rosa-quinonez/assets/family-aaaaaaaaaaaa',
		secureUrl:
			'https://res.cloudinary.com/test/image/upload/v1/preview/cumple/alba-rosa-quinonez/assets/family-aaaaaaaaaaaa.webp',
	},
	definitionSlug,
	operationId: '11111111-1111-4111-8111-111111111111',
	targetEnvironment: 'preview',
	eventType: 'cumple',
	slug: definitionSlug,
});

describe('buildHostedAssetUpsertSql', () => {
	it('rejects a legacy or cross-environment Cloudinary ID before building a mutation', () => {
		for (const publicId of [
			'cumple/alba-rosa-quinonez/assets/family-aaaaaaaaaaaa',
			'production/cumple/alba-rosa-quinonez/assets/family-aaaaaaaaaaaa',
		]) {
			expect(() =>
				buildHostedAssetUpsertSql({
					assetId: '7bce748d-8c86-40e3-b28e-0b5523640034',
					targetInvitationId: '28110aef-078d-46bd-857c-893e10e11bc1',
					asset: { ...familyAsset, provider: 'cloudinary', providerPublicId: publicId },
					definitionSlug,
					operationId: '11111111-1111-4111-8111-111111111111',
					targetEnvironment: 'preview',
					eventType: 'cumple',
					slug: definitionSlug,
				}),
			).toThrow();
		}
	});
	it('conflicts on primary key id, not bucket/storage_path', () => {
		expect(sql).toContain('on conflict (id) do update set');
		expect(sql).not.toContain('on conflict (bucket, storage_path)');
	});

	it('inserts the canonical path for new rows without rewriting path on conflict', () => {
		expect(sql).toContain("'managed/alba-rosa-quinonez/family.webp'");
		const setClause = (sql.split('on conflict (id) do update set')[1] ?? '').split('where')[0];
		expect(setClause).not.toMatch(/\bstorage_path\s*=/);
		expect(setClause).not.toMatch(/\bbucket\s*=/);
		expect(setClause).not.toMatch(/\binvitation_id\s*=/);
	});

	it('refuses to update a row owned by another invitation', () => {
		expect(sql).toContain('where invitation_assets.invitation_id = excluded.invitation_id');
	});
});

describe('assertHostedAssetUpsertApplied', () => {
	const assetId = '7bce748d-8c86-40e3-b28e-0b5523640034';

	it('accepts INSERT 0 1', () => {
		expect(() => assertHostedAssetUpsertApplied('INSERT 0 1\n', assetId)).not.toThrow();
	});

	it('fails closed on INSERT 0 0', () => {
		expect(() => assertHostedAssetUpsertApplied('INSERT 0 0\n', assetId)).toThrow(
			/did not apply for id 7bce748d-8c86-40e3-b28e-0b5523640034/,
		);
	});
});

describe('upsertAssetRows wiring', () => {
	const upsertFn = engineSource.slice(
		engineSource.indexOf('function upsertAssetRows'),
		engineSource.indexOf('function executePublicationRpcCall'),
	);

	it('reads command tags and rejects a no-op conflict update', () => {
		expect(upsertFn).toContain('tuplesOnly: false');
		expect(upsertFn).toContain('assertHostedAssetUpsertApplied');
		expect(upsertFn).toContain('buildHostedAssetUpsertSql');
	});
});

const liveFamilyRow: HostedAssetIdentityRow = {
	id: '7bce748d-8c86-40e3-b28e-0b5523640034',
	display_name: familyAsset.displayName,
	storage_path: familyAsset.storagePath,
	bucket: familyAsset.bucket,
	deleted_at: null,
};

const deletedFamilyRow: HostedAssetIdentityRow = {
	...liveFamilyRow,
	id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
	deleted_at: '2026-01-01T00:00:00Z',
};

const deletedAlias: HostedAssetIdentityRow = {
	...deletedFamilyRow,
	storage_path: 'managed/alba-rosa-quinonez/other.webp',
};

describe('selectHostedAssetIdentityRow', () => {
	it('reuses a live row by storage path', () => {
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [liveFamilyRow],
				definitionSlug,
			})?.id,
		).toBe(liveFamilyRow.id);
	});

	it('reuses a soft-deleted row with the same storage path', () => {
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [deletedFamilyRow],
				definitionSlug,
			})?.id,
		).toBe(deletedFamilyRow.id);
	});

	it('prefers the live row when a deleted row shares only the display name', () => {
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [liveFamilyRow, deletedAlias],
				definitionSlug,
			})?.id,
		).toBe(liveFamilyRow.id);
	});

	it('does not reuse a soft-deleted row that only matches display name', () => {
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [deletedAlias],
				definitionSlug,
			}),
		).toBeNull();
	});

	it('does not reuse a soft-deleted row with the same path in another bucket', () => {
		const deletedOtherBucket: HostedAssetIdentityRow = {
			...deletedFamilyRow,
			bucket: 'other-bucket',
		};
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [deletedOtherBucket],
				definitionSlug,
			}),
		).toBeNull();
	});

	it('does not reuse a live row with the same path in another bucket', () => {
		const liveOtherBucket: HostedAssetIdentityRow = {
			...liveFamilyRow,
			display_name: 'Otra fila viva en otro bucket',
			bucket: 'other-bucket',
		};
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [liveOtherBucket],
				definitionSlug,
			}),
		).toBeNull();
	});

	it('still fails closed on ambiguous live identity', () => {
		const otherLive: HostedAssetIdentityRow = {
			...liveFamilyRow,
			id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			storage_path: 'managed/alba-rosa-quinonez/other.webp',
		};
		expect(() =>
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [liveFamilyRow, otherLive],
				definitionSlug,
			}),
		).toThrow(/no se puede resolver de forma unívoca/);
	});

	it('reuses a managed row when a versioned asset changes path and display name', () => {
		const replacementAsset: InvitationPackageAsset = {
			...familyAsset,
			key: 'closing',
			displayName: 'Retrato de Norma sonriendo con la mano sobre la mejilla',
			storagePath: 'managed/norma-hernandez/closing-new-version.webp',
		};
		const priorClosingRow: HostedAssetIdentityRow = {
			...liveFamilyRow,
			display_name: 'Retrato de Norma con vestido azul de celebración',
			storage_path: 'managed/norma-hernandez/closing-prior-version.webp',
			managed_by_definition_slug: 'norma-hernandez',
			managed_source_key: 'closing',
		};

		expect(
			selectHostedAssetIdentityRow({
				asset: replacementAsset,
				rows: [priorClosingRow],
				definitionSlug: 'norma-hernandez',
			})?.id,
		).toBe(priorClosingRow.id);
	});

	it('does not reuse a managed row from another definition', () => {
		const managedElsewhere: HostedAssetIdentityRow = {
			...liveFamilyRow,
			display_name: 'Another invitation family',
			storage_path: 'managed/another-invitation/family.webp',
			managed_by_definition_slug: 'another-invitation',
			managed_source_key: familyAsset.key,
		};

		expect(
			selectHostedAssetIdentityRow({
				asset: { ...familyAsset, storagePath: 'managed/another/path.webp' },
				rows: [managedElsewhere],
				definitionSlug,
			}),
		).toBeNull();
	});
});

describe('resolveTargetAssetRefs wiring', () => {
	const resolveFn = engineSource.slice(
		engineSource.indexOf('function resolveTargetAssetRefs'),
		engineSource.indexOf('export function computeTargetAssetFingerprint'),
	);

	it('loads soft-deleted rows so prune-then-reimport can reuse id', () => {
		expect(resolveFn).toContain('selectHostedAssetIdentityRow');
		expect(resolveFn).toContain('managed_by_definition_slug');
		expect(resolveFn).toContain('managed_source_key');
		expect(resolveFn).not.toMatch(/deleted_at is null/);
	});

	it('uses Cloudinary delivery src instead of Supabase Storage for invitation images', () => {
		expect(resolveFn).toContain('resolveHostedUploadedAssetSrc');
		expect(resolveFn).not.toContain('`${targetStorageUrl}/${storagePath}`');
	});
});

describe('resolveHostedUploadedAssetSrc', () => {
	const storageUrl = 'https://preview.supabase.co/storage/v1/object/public/invitation-assets';

	it('uses packaged Cloudinary secureUrl and never a Storage host', () => {
		const src = resolveHostedUploadedAssetSrc(
			{
				...familyAsset,
				provider: 'cloudinary',
				providerPublicId: 'cumple/alba-rosa-quinonez/assets/family-aaaaaaaaaaaa',
				secureUrl:
					'https://res.cloudinary.com/dusxvauvj/image/upload/v1/cumple/alba-rosa-quinonez/assets/family-aaaaaaaaaaaa.webp',
			},
			null,
			storageUrl,
		);
		expect(src).toContain('res.cloudinary.com');
		expect(src).not.toContain('supabase.co/storage');
	});

	it('fails closed when Cloudinary identity is missing', () => {
		expect(() =>
			resolveHostedUploadedAssetSrc(
				{ ...familyAsset, provider: 'cloudinary' },
				null,
				storageUrl,
			),
		).toThrow(/missing secureUrl and providerPublicId/);
	});
});

describe('rewriteUploadedDeliverySrcs', () => {
	it('rewrites uploaded src and applies the OG Cloudinary transform', () => {
		const assetId = '7bce748d-8c86-40e3-b28e-0b5523640034';
		const storageHost =
			'https://preview.supabase.co/storage/v1/object/public/invitation-assets';
		const cloudinarySrc =
			'https://res.cloudinary.com/dusxvauvj/image/upload/v1/cumple/alba/assets/hero-aaa.webp';
		const rewritten = rewriteUploadedDeliverySrcs(
			{
				hero: { type: 'uploaded', assetId, src: `${storageHost}/managed/alba/hero.webp` },
				ogImage: {
					type: 'uploaded',
					assetId,
					src: `${storageHost}/managed/alba/hero.webp`,
				},
			},
			{ hero: { type: 'uploaded', assetId, src: cloudinarySrc } },
		) as Record<string, { src: string }>;
		expect(rewritten.hero.src).toBe(cloudinarySrc);
		expect(rewritten.ogImage.src).toContain('c_fill,g_auto,w_1200,h_630');
	});
});
