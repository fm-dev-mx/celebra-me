import { assertReconciledMutationTargets } from '../../scripts/provision/invitation-import-engine.ts';
import type {
	AssetReconciliationResult,
	TargetAssetRecord,
} from '../../scripts/provision/asset-reconciliation.ts';

const identity = { environment: 'preview' as const, eventType: 'xv', slug: 'renata' };
const record: TargetAssetRecord = {
	id: 'asset-id',
	displayName: 'Hero',
	storagePath: 'managed/renata/hero-old.webp',
	bucket: 'invitation-assets',
	mimeType: 'image/webp',
	fileSize: 10,
	width: 10,
	height: 10,
	validationVersion: 1,
	provider: 'r2',
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

describe('hosted R2 namespace guard', () => {
	it('rejects an asset under another invitation prefix even when reconciliation would reuse it', () => {
		expect(() =>
			assertReconciledMutationTargets(
				plan('REUSE'),
				[{ ...record, providerPublicId: 'invitations/xv/otra/hero-old.webp' }],
				identity,
			),
		).toThrow('belongs to another invitation');
	});
	it('rejects an asset under another event type prefix', () => {
		expect(() =>
			assertReconciledMutationTargets(
				plan('OVERWRITE'),
				[{ ...record, providerPublicId: 'invitations/boda/renata/hero-old.webp' }],
				identity,
			),
		).toThrow('belongs to another invitation');
	});
	it('allows an asset inside its own invitation prefix', () => {
		expect(() =>
			assertReconciledMutationTargets(
				plan('OVERWRITE'),
				[{ ...record, providerPublicId: 'invitations/xv/renata/hero-old.webp' }],
				identity,
			),
		).not.toThrow();
	});
	it('falls back to the storage path when the provider public id is absent', () => {
		expect(() =>
			assertReconciledMutationTargets(plan('REUSE'), [{ ...record }], identity),
		).toThrow('belongs to another invitation');
	});
	it('ignores non-R2 rows because they are not mutated through R2', () => {
		expect(() =>
			assertReconciledMutationTargets(
				plan('OVERWRITE'),
				[{ ...record, provider: 'supabase', providerPublicId: 'elsewhere/hero.webp' }],
				identity,
			),
		).not.toThrow();
	});
});
