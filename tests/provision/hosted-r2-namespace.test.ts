import {
	assertReconciledMutationTargets,
	isRekeySourceObject,
	keepRekeySourceObject,
} from '../../scripts/provision/invitation-import-engine.ts';
import type { InvitationPackageAsset } from '../../scripts/provision/invitation-package.ts';
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
function plan(
	action: 'REUSE' | 'OVERWRITE' | 'RETAIN' | 'UPLOAD' | 'REPAIR_METADATA',
): AssetReconciliationResult {
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
	describe('verified rekey source', () => {
		const sourceKey = 'invitations/xv/renata-vieja/hero-old.webp';
		it.each(['REUSE', 'RETAIN', 'REPAIR_METADATA', 'OVERWRITE', 'UPLOAD'] as const)(
			'allows %s of a row whose object is under the rekey source prefix',
			(action) => {
				expect(() =>
					assertReconciledMutationTargets(
						plan(action),
						[{ ...record, providerPublicId: sourceKey }],
						identity,
						'renata-vieja',
					),
				).not.toThrow();
			},
		);
		it('still rejects deleting an object under the rekey source prefix', () => {
			const base = plan('RETAIN');
			const pruning: AssetReconciliationResult = {
				...base,
				reconciledAssets: [],
				unreferencedAssets: [
					{ ...base.reconciledAssets[0]!, plannedAction: 'PRUNE_STORAGE_AND_METADATA' },
				],
			};
			expect(() =>
				assertReconciledMutationTargets(
					pruning,
					[{ ...record, providerPublicId: sourceKey }],
					identity,
					'renata-vieja',
				),
			).toThrow('belongs to another invitation');
		});
		it.each(['OVERWRITE', 'UPLOAD'] as const)(
			'still rejects %s of an object under another prefix during a rekey',
			(action) => {
				expect(() =>
					assertReconciledMutationTargets(
						plan(action),
						[{ ...record, providerPublicId: 'invitations/xv/otra/hero-old.webp' }],
						identity,
						'renata-vieja',
					),
				).toThrow('belongs to another invitation');
			},
		);
		it('still rejects reuse under a prefix that is not the rekey source', () => {
			expect(() =>
				assertReconciledMutationTargets(
					plan('REUSE'),
					[{ ...record, providerPublicId: 'invitations/xv/otra/hero-old.webp' }],
					identity,
					'renata-vieja',
				),
			).toThrow('belongs to another invitation');
		});
		it('keeps the old object, path and URL when repairing metadata after a verified rekey', () => {
			const pAsset = {
				key: 'hero',
				storagePath: 'managed/renata/hero-new.webp',
				providerPublicId: 'invitations/xv/renata/hero-new.webp',
				secureUrl:
					'https://media-staging.celebra-me.com/invitations/xv/renata/hero-new.webp',
			} as unknown as InvitationPackageAsset;
			const item = plan('REPAIR_METADATA').reconciledAssets[0]!;
			const kept = keepRekeySourceObject(
				pAsset,
				item,
				[{ ...record, providerPublicId: sourceKey }],
				identity,
				'renata-vieja',
			);
			expect(kept.providerPublicId).toBe(sourceKey);
			expect(kept.storagePath).toBe(record.storagePath);
			expect(kept.secureUrl).toBe(`https://media-staging.celebra-me.com/${sourceKey}`);
			expect(
				keepRekeySourceObject(
					pAsset,
					item,
					[{ ...record, providerPublicId: sourceKey }],
					identity,
					undefined,
				),
			).toBe(pAsset);
		});
		it('matches the source prefix only for the same event type and a full segment', () => {
			expect(isRekeySourceObject(sourceKey, 'xv', 'renata-vieja')).toBe(true);
			expect(isRekeySourceObject(sourceKey, 'boda', 'renata-vieja')).toBe(false);
			expect(
				isRekeySourceObject('invitations/xv/renata-viejas/a.webp', 'xv', 'renata-vieja'),
			).toBe(false);
			expect(isRekeySourceObject(sourceKey, 'xv', undefined)).toBe(false);
		});
	});
});
