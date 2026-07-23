import { describe, expect, it } from '@jest/globals';
import {
	reconcileAssets,
	parseAssetPolicy,
	type TargetAssetRecord,
	type ObservedStorageState,
} from '../../scripts/provision/asset-reconciliation.ts';
import type { InvitationPackageAsset } from '../../scripts/provision/invitation-package.ts';

const mockCanonicalAsset: InvitationPackageAsset = {
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
			canonicalAssets: [mockCanonicalAsset],
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

	it('classifies BINARY_MATCH_METADATA_DRIFT and plans REPAIR_METADATA under missing', () => {
		const observedStorage: Record<string, ObservedStorageState> = {
			'managed/romina-rios-chaparro/hero.webp': {
				present: true,
				sha256: 'b7a4f50f723982d06b5b5335b807e2dfa4e15558a4af7c0dff5bffe54c544fd6',
			},
		};

		const result = reconcileAssets({
			canonicalAssets: [mockCanonicalAsset],
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
			canonicalAssets: [mockCanonicalAsset],
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
			canonicalAssets: [mockCanonicalAsset],
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
			canonicalAssets: [mockCanonicalAsset],
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
			canonicalAssets: [mockCanonicalAsset],
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
			canonicalAssets: [mockCanonicalAsset],
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
			displayName: 'Old Photo',
			storagePath: 'managed/romina-rios-chaparro/old.webp',
			bucket: 'invitation-assets',
			mimeType: 'image/webp',
			fileSize: 12345,
			width: 500,
			height: 500,
			validationVersion: 1,
		};

		const resultRetain = reconcileAssets({
			canonicalAssets: [mockCanonicalAsset],
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
			canonicalAssets: [mockCanonicalAsset],
			targetDbAssets: [mockTargetDbRecord, unreferencedRecord],
			observedStorage: {
				'invitations/3d14155c-5c1e-4b47-a87a-0aa8af25e795/optimized/hero.webp': {
					present: true,
					sha256: mockCanonicalAsset.sha256,
				},
			},
			policy: 'missing',
			pruneAssets: true,
		});

		expect(resultPrune.summary.unreferenced).toBe(1);
		expect(resultPrune.summary.plannedDeletes).toBe(1);
		expect(resultPrune.unreferencedAssets[0]?.plannedAction).toBe('PRUNE');
	});
});
