import { assertReconciledMutationTargets } from '../../scripts/provision/invitation-import-engine.ts';
import type {
	AssetReconciliationResult,
	TargetAssetRecord,
} from '../../scripts/provision/asset-reconciliation.ts';

const identity = { environment: 'preview' as const, eventType: 'xv', slug: 'renata' };
const record: TargetAssetRecord = {
	id: 'asset-id',
	displayName: 'Hero',
	storagePath: 'xv/renata/assets/hero-old',
	bucket: 'invitation-assets',
	mimeType: 'image/webp',
	fileSize: 10,
	width: 10,
	height: 10,
	validationVersion: 1,
	provider: 'cloudinary',
	managedByDefinitionSlug: 'renata',
	managedSourceKey: 'hero',
};
function plan(action: 'REUSE' | 'OVERWRITE'): AssetReconciliationResult {
	return {
		policy: 'sync',
		pruneAssets: false,
		blocked: false,
		unreferencedAssets: [],
		reconciledAssets: [
			{
				key: 'hero',
				displayName: 'Hero',
				canonicalHash: 'a'.repeat(64),
				canonicalSize: 10,
				canonicalMimeType: 'image/webp',
				targetStoragePath: record.storagePath,
				targetAssetId: record.id,
				classification: 'MATCH',
				plannedAction: action,
				reasonCode: 'MATCH',
				reason: 'match',
				observedHash: null,
				observedSize: 10,
			},
		],
		summary: {
			totalCanonical: 1,
			match: 1,
			metadataDrift: 0,
			missing: 0,
			contentMismatch: 0,
			invalid: 0,
			unreferenced: 0,
			plannedUploads: 0,
			plannedOverwrites: 0,
			plannedMetadataRepairs: 0,
			plannedReuses: 1,
			plannedDeletes: 0,
		},
	};
}

describe('hosted Cloudinary namespace guard', () => {
	it('rejects a cross-environment asset even when reconciliation would reuse it', () => {
		const result = plan('REUSE');
		expect(() =>
			assertReconciledMutationTargets(
				result,
				[{ ...record, providerPublicId: 'production/xv/renata/assets/hero-old' }],
				identity,
			),
		).toThrow('namespace mismatch');
	});
	it('allows a legacy asset for read-only reuse', () => {
		expect(() =>
			assertReconciledMutationTargets(
				plan('REUSE'),
				[{ ...record, providerPublicId: 'xv/renata/assets/hero-old' }],
				identity,
			),
		).not.toThrow();
	});
	it('blocks mutation of a legacy asset', () => {
		expect(() =>
			assertReconciledMutationTargets(
				plan('OVERWRITE'),
				[{ ...record, providerPublicId: 'xv/renata/assets/hero-old' }],
				identity,
			),
		).toThrow('namespace mismatch');
	});
});
