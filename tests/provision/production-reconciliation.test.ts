import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import {
	buildLegacyAdoptionPlan,
	buildProductionSemanticDiff,
	createLegacyAdoptionManifest,
	validateLegacyAdoptionManifest,
	type AdoptionAssetMapping,
} from '../../scripts/provision/production-reconciliation.ts';

const hash = 'a'.repeat(64);
const md5 = 'b'.repeat(32);
const assets: AdoptionAssetMapping[] = Array.from({ length: 11 }, (_, index) => ({
	semanticKey: `asset-${index}`,
	sha256: hash,
	mimeType: 'image/webp',
	width: 100,
	height: 200,
	assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
	storagePath: `invitations/romina/asset-${index}.webp`,
}));

const canonical = {
	family: { labels: { sectionSubtitle: 'Familia', sectionTitle: 'Con el amor de mis padres' } },
	hero: { image: { assetId: '__INVITATION_ASSET_KEY__:asset-0', src: '__STORAGE_URL__/asset-0' } },
};
const production = {
	family: { labels: { sectionTitle: 'Mi familia' } },
	hero: { image: { assetId: assets[0].assetId, src: `https://prod/${assets[0].storagePath}` } },
};

function manifestFor(pathDecisions = buildProductionSemanticDiff(canonical, production, production)) {
	return createLegacyAdoptionManifest({
		schemaVersion: '1.0.0',
		operation: 'legacy-production-adoption',
		target: 'production',
		slug: 'romina-rios-chaparro',
		invitationId: '11111111-1111-4111-8111-111111111111',
		approvedRelease: {
			sourceHash: hash,
			packageHash: 'c'.repeat(64),
			metadataHash: 'd'.repeat(64),
			projectionHash: md5,
			assetManifestHash: 'e'.repeat(64),
		},
		expectedTarget: {
			draftId: '22222222-2222-4222-8222-222222222222',
			draftUpdatedAt: '2026-07-18T20:55:09.948Z',
			draftHash: md5,
			publishedVersion: 1,
			publishedHash: md5,
		},
		pathDecisions: pathDecisions.map((difference) => ({
			path: difference.path,
			decision:
				difference.classification === 'target-specific-materialization'
					? 'preserve-target-materialization'
					: 'replace-with-approved',
		})),
		assetMappings: assets,
		protectedPathPolicy: [
			'content.invitation.', 'content.events.', 'content.guests.', 'content.rsvps.',
			'content.analytics.', 'content.claimCodes.', 'content.intake.', 'content.audit.',
		],
		expectedOperations: {
			draftUpdates: 1, publishedUpdates: 1, provenanceInserts: 1, receiptInserts: 1,
			storageUploads: 0, storageOverwrites: 0, storageMoves: 0, storageDeletes: 0,
		},
	});
}

describe('legacy Production adoption domain', () => {
	it('classifies reviewed Family paths as canonical replacements and asset references as materialization', () => {
		const differences = buildProductionSemanticDiff(canonical, production, production);
		expect(differences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'content.family.labels.sectionSubtitle', classification: 'canonical-replacement',
				}),
				expect.objectContaining({
					path: 'content.hero.image.assetId', classification: 'target-specific-materialization',
				}),
			]),
		);
	});

	it('rejects protected path decisions, duplicate decisions, and incomplete mappings', () => {
		const manifest = manifestFor();
		expect(() =>
			validateLegacyAdoptionManifest({
				...manifest,
				pathDecisions: [...manifest.pathDecisions, { path: 'content.guests.count', decision: 'replace-with-approved' }],
			}),
		).toThrow(/protected path/i);
		expect(() =>
			validateLegacyAdoptionManifest({
				...manifest,
				pathDecisions: [...manifest.pathDecisions, manifest.pathDecisions[0]],
			}),
		).toThrow(/duplicate path decisions/i);
		expect(() => validateLegacyAdoptionManifest({ ...manifest, assetMappings: assets.slice(0, 10) }))
			.toThrow(/exactly eleven/i);
	});

	it('builds a deterministic approved plan with zero Storage operations', () => {
		const manifest = manifestFor();
		const input = {
			manifest,
			approvedContent: canonical,
			productionDraft: production,
			productionPublished: production,
			materializedContent: production,
		};
		const first = buildLegacyAdoptionPlan(input);
		const second = buildLegacyAdoptionPlan(input);
		expect(second).toEqual(first);
		expect(first.storageMutations).toEqual({ uploads: 0, overwrites: 0, moves: 0, deletes: 0 });
		expect(first.databaseWrites).toEqual({ draftUpdates: 1, publishedUpdates: 1, provenanceInserts: 1, receiptInserts: 1 });
		const expectedIdentity = createHash('sha256')
			.update(`${manifest.invitationId}\u001flegacy-production-adoption\u001f${manifest.approvedRelease.packageHash}\u001f${manifest.manifestHash}`)
			.digest('hex');
		expect(first.adoptionIdentity).toBe(expectedIdentity);
	});

	it('fails closed when a manifest omits a reviewed semantic decision', () => {
		const decisions = buildProductionSemanticDiff(canonical, production, production).slice(1);
		const manifest = manifestFor(decisions);
		expect(() =>
			buildLegacyAdoptionPlan({
				manifest,
				approvedContent: canonical,
				productionDraft: production,
				productionPublished: production,
				materializedContent: production,
			}),
		).toThrow(/unapproved/i);
	});
});
