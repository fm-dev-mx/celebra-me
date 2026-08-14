import { describe, expect, it } from '@jest/globals';
import {
	reconcileAssets,
	parseAssetPolicy,
	type TargetAssetRecord,
	type ObservedStorageState,
} from '../../scripts/provision/asset-reconciliation.ts';
import type { InvitationPackageAsset } from '../../scripts/provision/invitation-package.ts';

const mockStorageCanonicalAsset: InvitationPackageAsset = {
	key: 'hero',
	displayName: 'Romina — portada',
	defaultAltText: 'Romina portada',
	bucket: 'invitation-assets',
	storagePath: 'managed/romina-rios-chaparro/hero.webp',
	mimeType: 'image/webp',
	width: 1000,
	height: 1000,
	fileSize: 50000,
	validationVersion: 1,
	originalMimeType: 'image/jpeg',
	originalFileSize: 60000,
	sha256: 'b7a4f50f723982d06b5b5335b807e2dfa4e15558a4af7c0dff5bffe54c544fd6',
	dataBase64: 'mockbase64',
};

const mockCanonicalAsset: InvitationPackageAsset = {
	...mockStorageCanonicalAsset,
	provider: 'cloudinary',
	providerPublicId: 'xv/romina-rios-chaparro/assets/hero-b7a4f50f7239',
};

const mockTargetDbRecord: TargetAssetRecord = {
	id: '4c2f6354-44e5-4eb5-a212-e3eef433e747',
	displayName: 'Romina — portada',
	storagePath: 'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp',
	bucket: 'invitation-assets',
	mimeType: 'image/webp',
	fileSize: 50000,
	width: 1000,
	height: 1000,
	validationVersion: 1,
	originalMimeType: 'image/jpeg',
	originalFileSize: 60000,
	altText: 'Romina portada',
};

describe('asset-reconciliation engine', () => {
	it('parses valid asset policies and defaults to missing', () => {
		expect(parseAssetPolicy(undefined)).toBe('missing');
		expect(parseAssetPolicy('verify')).toBe('verify');
		expect(parseAssetPolicy('missing')).toBe('missing');
		expect(parseAssetPolicy('sync')).toBe('sync');
		expect(() => parseAssetPolicy('invalid')).toThrow(/Política de archivos no válida/);
	});

	it('classifies MATCH and plans REUSE when binary and metadata match across paths', () => {
		const observedStorage: Record<string, ObservedStorageState> = {
			'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
				present: true,
				sha256: 'b7a4f50f723982d06b5b5335b807e2dfa4e15558a4af7c0dff5bffe54c544fd6',
			},
		};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord],
			observedStorage,
			policy: 'missing',
		});

		expect(result.blocked).toBe(false);
		expect(result.summary.match).toBe(1);
		expect(result.summary.plannedReuses).toBe(1);
		expect(result.summary.plannedUploads).toBe(0);
		expect(result.reconciledAssets[0]?.classification).toBe('MATCH');
		expect(result.reconciledAssets[0]?.plannedAction).toBe('REUSE');
	});

	it('plans Cloudinary upload when the target row is still on Supabase Storage', () => {
		const result = reconcileAssets({
			canonicalAssets: [
				{
					...mockCanonicalAsset,
					provider: 'cloudinary',
					providerPublicId: 'xv/romina-rios-chaparro/assets/hero-b7a4f50f7239',
				},
			],
			targetDbAssets: [mockTargetDbRecord],
			observedStorage: {
				'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
			},
			policy: 'missing',
		});

		expect(result.blocked).toBe(false);
		expect(result.reconciledAssets[0]?.plannedAction).toBe('UPLOAD');
		expect(result.reconciledAssets[0]?.reasonCode).toBe('ASSET_CLOUDINARY_UPLOAD');
	});

	it('classifies MATCH and plans REUSE when the target row is already Cloudinary', () => {
		const result = reconcileAssets({
			canonicalAssets: [mockCanonicalAsset],
			targetDbAssets: [
				{
					...mockTargetDbRecord,
					provider: 'cloudinary',
					providerPublicId: mockCanonicalAsset.providerPublicId,
					secureUrl:
						'https://res.cloudinary.com/demo/image/upload/v1/xv/romina-rios-chaparro/assets/hero-b7a4f50f7239.webp',
					sha256: mockCanonicalAsset.sha256,
					managedByDefinitionSlug: 'romina-rios-chaparro',
					managedSourceKey: 'hero',
				},
			],
			observedStorage: {},
			policy: 'missing',
			definitionSlug: 'romina-rios-chaparro',
		});

		expect(result.blocked).toBe(false);
		expect(result.reconciledAssets[0]?.classification).toBe('MATCH');
		expect(result.reconciledAssets[0]?.plannedAction).toBe('REUSE');
		expect(result.reconciledAssets[0]?.reasonCode).toBe('ASSET_MATCH_EXISTS');
	});

	it('selects the referenced duplicate and repairs its semantic key without pruning peers', () => {
		const referenced: TargetAssetRecord = {
			...mockTargetDbRecord,
			id: '11111111-1111-4111-8111-111111111111',
		};
		const duplicate: TargetAssetRecord = {
			...mockTargetDbRecord,
			id: '22222222-2222-4222-8222-222222222222',
			storagePath: 'invitations/duplicate/optimized/hero.webp',
		};
		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [referenced, duplicate],
			observedStorage: {
				[referenced.storagePath]: { present: true, sha256: mockCanonicalAsset.sha256 },
				[duplicate.storagePath]: { present: true, sha256: mockCanonicalAsset.sha256 },
			},
			policy: 'sync',
			definitionSlug: 'romina-rios-chaparro',
			referencedAssetIds: new Set([referenced.id]),
		});

		expect(result.blocked).toBe(false);
		expect(result.summary.plannedMetadataRepairs).toBe(1);
		expect(result.reconciledAssets[0]).toEqual(
			expect.objectContaining({
				targetAssetId: referenced.id,
				classification: 'BINARY_MATCH_METADATA_DRIFT',
				plannedAction: 'REPAIR_METADATA',
			}),
		);
		expect(result.summary.plannedDeletes).toBe(0);
	});

	it('classifies BINARY_MATCH_METADATA_DRIFT and plans REPAIR_METADATA under missing', () => {
		const observedStorage: Record<string, ObservedStorageState> = {
			'managed/romina-rios-chaparro/hero.webp': {
				present: true,
				sha256: 'b7a4f50f723982d06b5b5335b807e2dfa4e15558a4af7c0dff5bffe54c544fd6',
			},
		};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [],
			observedStorage,
			policy: 'missing',
		});

		expect(result.blocked).toBe(false);
		expect(result.summary.metadataDrift).toBe(1);
		expect(result.summary.plannedMetadataRepairs).toBe(1);
		expect(result.summary.plannedUploads).toBe(0);
		expect(result.reconciledAssets[0]?.classification).toBe('BINARY_MATCH_METADATA_DRIFT');
		expect(result.reconciledAssets[0]?.plannedAction).toBe('REPAIR_METADATA');
	});

	it('blocks BINARY_MATCH_METADATA_DRIFT under verify policy', () => {
		const observedStorage: Record<string, ObservedStorageState> = {
			'managed/romina-rios-chaparro/hero.webp': {
				present: true,
				sha256: 'b7a4f50f723982d06b5b5335b807e2dfa4e15558a4af7c0dff5bffe54c544fd6',
			},
		};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [],
			observedStorage,
			policy: 'verify',
		});

		expect(result.blocked).toBe(true);
		expect(result.blockReason).toContain('verify');
	});

	it('classifies MISSING and plans UPLOAD under missing policy', () => {
		const observedStorage: Record<string, ObservedStorageState> = {};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [],
			observedStorage,
			policy: 'missing',
		});

		expect(result.blocked).toBe(false);
		expect(result.summary.missing).toBe(1);
		expect(result.summary.plannedUploads).toBe(1);
		expect(result.reconciledAssets[0]?.classification).toBe('MISSING');
		expect(result.reconciledAssets[0]?.plannedAction).toBe('UPLOAD');
	});

	it('blocks MISSING assets under verify policy', () => {
		const observedStorage: Record<string, ObservedStorageState> = {};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [],
			observedStorage,
			policy: 'verify',
		});

		expect(result.blocked).toBe(true);
		expect(result.reconciledAssets[0]?.plannedAction).toBe('BLOCK');
	});

	it('blocks CONTENT_MISMATCH under missing policy', () => {
		const observedStorage: Record<string, ObservedStorageState> = {
			'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
				present: true,
				sha256: '1111111111111111111111111111111111111111111111111111111111111111',
			},
		};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord],
			observedStorage,
			policy: 'missing',
		});

		expect(result.blocked).toBe(true);
		expect(result.reconciledAssets[0]?.classification).toBe('CONTENT_MISMATCH');
		expect(result.reconciledAssets[0]?.plannedAction).toBe('BLOCK');
	});

	it('plans OVERWRITE for CONTENT_MISMATCH under sync policy', () => {
		const observedStorage: Record<string, ObservedStorageState> = {
			'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
				present: true,
				sha256: '1111111111111111111111111111111111111111111111111111111111111111',
			},
		};

		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord],
			observedStorage,
			policy: 'sync',
		});

		expect(result.blocked).toBe(false);
		expect(result.summary.contentMismatch).toBe(1);
		expect(result.summary.plannedOverwrites).toBe(1);
		expect(result.reconciledAssets[0]?.plannedAction).toBe('OVERWRITE');
	});

	it('retains UNREFERENCED assets by default and prunes only with pruneAssets option', () => {
		const unreferencedRecord: TargetAssetRecord = {
			id: '99999999-9999-9999-9999-999999999999',
			invitationId: '3d14155c-5c1e-4b47-a87a-0aa8af25e795',
			displayName: 'Old Photo',
			storagePath: 'managed/romina-rios-chaparro/old.webp',
			bucket: 'invitation-assets',
			mimeType: 'image/webp',
			fileSize: 12345,
			width: 500,
			height: 500,
			validationVersion: 1,
			provider: 'supabase',
			managedByDefinitionSlug: 'romina-rios-chaparro',
			managedSourceKey: 'old-photo',
			managedSha256: 'c'.repeat(64),
			managedOperationId: '11111111-1111-4111-8111-111111111111',
		};

		const resultRetain = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord, unreferencedRecord],
			observedStorage: {
				'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
			},
			policy: 'missing',
			pruneAssets: false,
		});

		expect(resultRetain.summary.unreferenced).toBe(1);
		expect(resultRetain.summary.plannedDeletes).toBe(0);
		expect(resultRetain.unreferencedAssets[0]?.plannedAction).toBe('RETAIN');

		const resultPrune = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord, unreferencedRecord],
			observedStorage: {
				'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
				'managed/romina-rios-chaparro/old.webp': {
					present: true,
					sha256: 'c'.repeat(64),
				},
			},
			policy: 'missing',
			pruneAssets: true,
			definitionSlug: 'romina-rios-chaparro',
			targetInvitationId: '3d14155c-5c1e-4b47-a87a-0aa8af25e795',
			referencedAssetIds: new Set(),
		});

		expect(resultPrune.summary.unreferenced).toBe(1);
		expect(resultPrune.summary.plannedDeletes).toBe(1);
		expect(resultPrune.unreferencedAssets[0]?.plannedAction).toBe('PRUNE_STORAGE_AND_METADATA');
	});

	it('preserves unmanaged assets even when pruning is requested', () => {
		const unmanaged: TargetAssetRecord = {
			...mockTargetDbRecord,
			id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			displayName: 'Host upload',
			storagePath: 'invitations/host-owned.webp',
			invitationId: '3d14155c-5c1e-4b47-a87a-0aa8af25e795',
			managedByDefinitionSlug: null,
		};
		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord, unmanaged],
			observedStorage: {
				[mockTargetDbRecord.storagePath]: {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
				[unmanaged.storagePath]: { present: true, sha256: 'd'.repeat(64) },
			},
			policy: 'missing',
			pruneAssets: true,
			definitionSlug: 'romina-rios-chaparro',
			targetInvitationId: '3d14155c-5c1e-4b47-a87a-0aa8af25e795',
		});
		expect(result.unreferencedAssets).toContainEqual(
			expect.objectContaining({
				targetAssetId: unmanaged.id,
				classification: 'TARGET_OWNED',
				plannedAction: 'RETAIN',
			}),
		);
	});

	it('prunes stale managed metadata without scheduling a Storage delete', () => {
		const stale: TargetAssetRecord = {
			...mockTargetDbRecord,
			id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			invitationId: '3d14155c-5c1e-4b47-a87a-0aa8af25e795',
			displayName: 'Stale',
			storagePath: 'managed/romina-rios-chaparro/stale.webp',
			managedByDefinitionSlug: 'romina-rios-chaparro',
			managedSourceKey: 'stale',
			managedSha256: 'e'.repeat(64),
			managedOperationId: '11111111-1111-4111-8111-111111111111',
		};
		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord, stale],
			observedStorage: {
				[mockTargetDbRecord.storagePath]: {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
				[stale.storagePath]: { present: false, sha256: null },
			},
			pruneAssets: true,
			definitionSlug: 'romina-rios-chaparro',
			targetInvitationId: stale.invitationId,
		});
		expect(result.unreferencedAssets).toContainEqual(
			expect.objectContaining({
				targetAssetId: stale.id,
				classification: 'STALE_METADATA',
				plannedAction: 'PRUNE_METADATA',
			}),
		);
	});

	it('retains a managed asset still referenced by resulting content', () => {
		const referenced: TargetAssetRecord = {
			...mockTargetDbRecord,
			id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
			invitationId: '3d14155c-5c1e-4b47-a87a-0aa8af25e795',
			displayName: 'Referenced old asset',
			managedByDefinitionSlug: 'romina-rios-chaparro',
			managedSourceKey: 'old',
			managedSha256: 'f'.repeat(64),
			managedOperationId: '11111111-1111-4111-8111-111111111111',
		};
		const result = reconcileAssets({
			canonicalAssets: [mockStorageCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord, referenced],
			observedStorage: {
				[mockTargetDbRecord.storagePath]: {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
			},
			pruneAssets: true,
			definitionSlug: 'romina-rios-chaparro',
			targetInvitationId: referenced.invitationId,
			referencedAssetIds: new Set([referenced.id]),
		});
		expect(result.unreferencedAssets).toContainEqual(
			expect.objectContaining({
				targetAssetId: referenced.id,
				classification: 'STILL_REFERENCED',
				plannedAction: 'RETAIN',
			}),
		);
	});
});
