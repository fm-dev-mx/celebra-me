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

const sql = buildHostedAssetUpsertSql({
	assetId: '7bce748d-8c86-40e3-b28e-0b5523640034',
	targetInvitationId: '28110aef-078d-46bd-857c-893e10e11bc1',
	asset: familyAsset,
	definitionSlug: 'alba-rosa-quinonez',
	operationId: '11111111-1111-4111-8111-111111111111',
});

describe('buildHostedAssetUpsertSql', () => {
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
		expect(sql).toContain(
			'where invitation_assets.invitation_id = excluded.invitation_id',
		);
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
	const source = readFileSync(
		resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
		'utf8',
	);
	const upsertFn = source.slice(
		source.indexOf('function upsertAssetRows'),
		source.indexOf('function executePublicationRpcCall'),
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

describe('selectHostedAssetIdentityRow', () => {
	it('reuses a live row by storage path', () => {
		expect(selectHostedAssetIdentityRow({ asset: familyAsset, rows: [liveFamilyRow] })?.id).toBe(
			liveFamilyRow.id,
		);
	});

	it('reuses a soft-deleted row with the same storage path', () => {
		expect(
			selectHostedAssetIdentityRow({ asset: familyAsset, rows: [deletedFamilyRow] })?.id,
		).toBe(deletedFamilyRow.id);
	});

	it('prefers the live row when a deleted row shares only the display name', () => {
		const deletedAlias: HostedAssetIdentityRow = {
			...deletedFamilyRow,
			storage_path: 'managed/alba-rosa-quinonez/other.webp',
		};
		expect(
			selectHostedAssetIdentityRow({
				asset: familyAsset,
				rows: [liveFamilyRow, deletedAlias],
			})?.id,
		).toBe(liveFamilyRow.id);
	});

	it('does not reuse a soft-deleted row that only matches display name', () => {
		const deletedAlias: HostedAssetIdentityRow = {
			...deletedFamilyRow,
			storage_path: 'managed/alba-rosa-quinonez/other.webp',
		};
		expect(selectHostedAssetIdentityRow({ asset: familyAsset, rows: [deletedAlias] })).toBeNull();
	});

	it('does not reuse a soft-deleted row with the same path in another bucket', () => {
		const deletedOtherBucket: HostedAssetIdentityRow = {
			...deletedFamilyRow,
			bucket: 'other-bucket',
		};
		expect(
			selectHostedAssetIdentityRow({ asset: familyAsset, rows: [deletedOtherBucket] }),
		).toBeNull();
	});

	it('still fails closed on ambiguous live identity', () => {
		const otherLive: HostedAssetIdentityRow = {
			...liveFamilyRow,
			id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			storage_path: 'managed/alba-rosa-quinonez/other.webp',
		};
		expect(() =>
			selectHostedAssetIdentityRow({ asset: familyAsset, rows: [liveFamilyRow, otherLive] }),
		).toThrow(/no se puede resolver de forma unívoca/);
	});
});

describe('resolveTargetAssetRefs wiring', () => {
	const source = readFileSync(
		resolve(process.cwd(), 'scripts/provision/invitation-import-engine.ts'),
		'utf8',
	);
	const resolveFn = source.slice(
		source.indexOf('function resolveTargetAssetRefs'),
		source.indexOf('export function computeTargetAssetFingerprint'),
	);

	it('loads soft-deleted rows so prune-then-reimport can reuse id', () => {
		expect(resolveFn).toContain('selectHostedAssetIdentityRow');
		expect(resolveFn).not.toMatch(/deleted_at is null/);
	});
});
