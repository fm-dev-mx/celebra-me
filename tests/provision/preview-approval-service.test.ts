import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createPendingPreviewApprovalArtifact,
	finalizePreviewApprovalArtifact,
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	verifyPreviewApprovalArtifact,
	type PreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';
import {
	createMemoryPreviewApprovalStore,
	setDefaultPreviewApprovalStoreForTests,
} from '../../scripts/provision/preview-approval-store.ts';

const createdDirs: string[] = [];
const PACKAGE_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);
const METADATA_HASH = 'c'.repeat(64);
const CANONICAL_PROJECTION_HASH = 'd'.repeat(32);
const MATERIALIZED_PROJECTION_HASH = 'e'.repeat(32);
const ASSET_MANIFEST_HASH = 'f'.repeat(64);
const ASSET_HASH = '1'.repeat(64);
const ASSET_PATH = 'managed/test/hero.webp';
const PLAN_ID = 'preview-plan-1234';
const BASE_REVIEW_EVIDENCE = {
	planId: PLAN_ID,
	reviewedAt: new Date().toISOString(),
	reviewedBy: 'qa@celebra-me.test',
	intendedProductionProjectRef: 'productionproject',
};

beforeEach(() => {
	setDefaultPreviewApprovalStoreForTests(createMemoryPreviewApprovalStore());
});

afterEach(() => {
	setDefaultPreviewApprovalStoreForTests(null);
	createdDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function writeEvidence(
	hashes: Record<string, string>,
	overrides: Record<string, unknown> = {},
): string {
	const dir = mkdtempSync(join(tmpdir(), 'celebra-approval-evidence-'));
	createdDirs.push(dir);
	const path = join(dir, 'evidence.json');
	writeFileSync(
		path,
		JSON.stringify({
			...BASE_REVIEW_EVIDENCE,
			packageHash: PACKAGE_HASH,
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/xv/test-invitation',
			projectionHash: MATERIALIZED_PROJECTION_HASH,
			checklistResults: { route: true, dashboard: true },
			storageHashVerification: hashes,
			...overrides,
		}),
	);
	return path;
}

function createPending(expectedAssetHashes?: Record<string, string>): PreviewApprovalArtifact {
	return createPendingPreviewApprovalArtifact({
		packageHash: PACKAGE_HASH,
		sourceHash: SOURCE_HASH,
		metadataHash: METADATA_HASH,
		assetManifestHash: ASSET_MANIFEST_HASH,
		planId: PLAN_ID,
		slug: 'test-invitation',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		route: '/xv/test-invitation',
		canonicalProjectionHash: CANONICAL_PROJECTION_HASH,
		materializedProjectionHash: MATERIALIZED_PROJECTION_HASH,
		expectedAssetHashes: expectedAssetHashes ?? { [ASSET_PATH]: ASSET_HASH },
	});
}

function productionIdentity(overrides: Record<string, string> = {}) {
	return {
		packageHash: PACKAGE_HASH,
		sourceHash: SOURCE_HASH,
		metadataHash: METADATA_HASH,
		projectionHash: CANONICAL_PROJECTION_HASH,
		assetManifestHash: ASSET_MANIFEST_HASH,
		slug: 'test-invitation',
		route: '/xv/test-invitation',
		...overrides,
	};
}

describe('Preview approval artifact (shared store)', () => {
	it('keeps canonical and Preview-materialized projection hashes distinct', () => {
		const pending = createPending();
		expect(pending.schemaVersion).toBe(PREVIEW_APPROVAL_SCHEMA_VERSION);
		expect(pending.canonicalProjectionHash).toBe(CANONICAL_PROJECTION_HASH);
		expect(pending.materializedProjectionHash).toBe(MATERIALIZED_PROJECTION_HASH);
		expect(pending.canonicalProjectionHash).not.toBe(pending.materializedProjectionHash);

		const approved = finalizePreviewApprovalArtifact({
			packageHash: PACKAGE_HASH,
			evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }),
		});
		expect(approved.approvalState).toBe('approved');
		const verified = verifyPreviewApprovalArtifact(productionIdentity());
		expect(verified.canonicalProjectionHash).toBe(CANONICAL_PROJECTION_HASH);
		expect(verified.hostedValidation?.projectionHash).toBe(MATERIALIZED_PROJECTION_HASH);
	});

	it('finalizes against materialized Preview hash and verifies Production against canonical hash', () => {
		createPending();
		expect(
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }),
			}).approvalState,
		).toBe('approved');
		expect(verifyPreviewApprovalArtifact(productionIdentity()).approvalState).toBe('approved');
	});

	it('rejects hosted evidence bound to the canonical hash instead of the materialized hash', () => {
		createPending();
		expect(() =>
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence(
					{ [ASSET_PATH]: ASSET_HASH },
					{ projectionHash: CANONICAL_PROJECTION_HASH },
				),
			}),
		).toThrow(/does not satisfy the pending approval artifact/i);
	});

	it('rejects Production identity that supplies the materialized hash as the canonical projection', () => {
		createPending();
		finalizePreviewApprovalArtifact({
			packageHash: PACKAGE_HASH,
			evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }),
		});
		expect(() =>
			verifyPreviewApprovalArtifact(
				productionIdentity({ projectionHash: MATERIALIZED_PROJECTION_HASH }),
			),
		).toThrow(/exact release hashes/i);
	});

	it('rejects obsolete single-projectionHash artifacts instead of migrating them', () => {
		const store = createMemoryPreviewApprovalStore([
			{
				schemaVersion: '2.0.0' as never,
				approvalState: 'approved',
				packageHash: PACKAGE_HASH,
				sourceHash: SOURCE_HASH,
				metadataHash: METADATA_HASH,
				canonicalProjectionHash: CANONICAL_PROJECTION_HASH,
				materializedProjectionHash: CANONICAL_PROJECTION_HASH,
				assetManifestHash: ASSET_MANIFEST_HASH,
				planId: PLAN_ID,
				slug: 'test-invitation',
				previewProjectRef: 'iwipdvisoyerfdytuhwi',
				createdAt: new Date().toISOString(),
				approvedAt: new Date().toISOString(),
				approvedBy: 'qa@celebra-me.test',
				intendedProductionProjectRef: 'productionproject',
				route: '/xv/test-invitation',
				expectedAssetHashes: {},
				hostedValidation: {
					packageHash: PACKAGE_HASH,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: CANONICAL_PROJECTION_HASH,
					planId: PLAN_ID,
					reviewedAt: new Date().toISOString(),
					reviewedBy: 'qa@celebra-me.test',
					intendedProductionProjectRef: 'productionproject',
					checklistResults: { route: true },
					storageHashVerification: {},
				},
			},
		]);
		setDefaultPreviewApprovalStoreForTests(store);
		expect(() => verifyPreviewApprovalArtifact(productionIdentity())).toThrow(
			/obsolete contract/i,
		);

		const regenerated = createPending({});
		expect(regenerated.approvalState).toBe('pending_hosted_validation');
		expect(regenerated.schemaVersion).toBe(PREVIEW_APPROVAL_SCHEMA_VERSION);
	});

	it('rejects incomplete storage evidence', () => {
		createPending();
		expect(() =>
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence({}, { storageHashVerification: {} }),
			}),
		).toThrow(/missing storage hash verification for asset/i);
	});

	it('rejects missing storageHashVerification', () => {
		createPending();
		const path = writeEvidence({ [ASSET_PATH]: ASSET_HASH });
		const evidence = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
		delete evidence.storageHashVerification;
		writeFileSync(path, JSON.stringify(evidence));
		expect(() =>
			finalizePreviewApprovalArtifact({ packageHash: PACKAGE_HASH, evidencePath: path }),
		).toThrow(/missing required storage hash verification/i);
	});

	it('rejects one missing asset when multiple are expected', () => {
		createPending({
			[ASSET_PATH]: ASSET_HASH,
			'managed/test/second.webp': '2'.repeat(64),
		});
		expect(() =>
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }),
			}),
		).toThrow(/missing storage hash verification for asset/i);
	});

	it('rejects incorrect asset hash', () => {
		createPending();
		expect(() =>
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence({ [ASSET_PATH]: 'wronghashvalue' }),
			}),
		).toThrow(/storage hash mismatch for asset/i);
	});

	it('allows finalization when no expected assets exist', () => {
		createPending({});
		const path = writeEvidence({});
		const evidence = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
		delete evidence.storageHashVerification;
		writeFileSync(path, JSON.stringify(evidence));
		expect(
			finalizePreviewApprovalArtifact({ packageHash: PACKAGE_HASH, evidencePath: path })
				.approvalState,
		).toBe('approved');
		expect(verifyPreviewApprovalArtifact(productionIdentity()).approvalState).toBe('approved');
	});

	it('rejects a stale approved artifact', () => {
		createPending();
		const approved = finalizePreviewApprovalArtifact({
			packageHash: PACKAGE_HASH,
			evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }),
		});
		const store = createMemoryPreviewApprovalStore([
			{ ...approved, approvedAt: '2026-06-01T00:00:00.000Z' },
		]);
		setDefaultPreviewApprovalStoreForTests(store);
		expect(() =>
			verifyPreviewApprovalArtifact(
				{
					...productionIdentity(),
					planId: PLAN_ID,
					intendedProductionProjectRef: 'productionproject',
				},
				{},
				new Date('2026-07-23T00:00:00.000Z'),
			),
		).toThrow(/stale/i);
	});

	it('rejects an approval intended for a different Production project', () => {
		createPending();
		finalizePreviewApprovalArtifact({
			packageHash: PACKAGE_HASH,
			evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }),
		});
		expect(() =>
			verifyPreviewApprovalArtifact({
				...productionIdentity(),
				planId: PLAN_ID,
				intendedProductionProjectRef: 'anotherproject',
			}),
		).toThrow(/stale, incomplete, or does not match/i);
	});

	it('rejects approval evidence whose executed Preview plan ID does not match', () => {
		createPending();
		expect(() =>
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence(
					{ [ASSET_PATH]: ASSET_HASH },
					{ planId: 'different-preview-plan' },
				),
			}),
		).toThrow(/executed Preview plan/i);
	});

	it('rejects approval evidence without reviewer identity', () => {
		createPending();
		expect(() =>
			finalizePreviewApprovalArtifact({
				packageHash: PACKAGE_HASH,
				evidencePath: writeEvidence({ [ASSET_PATH]: ASSET_HASH }, { reviewedBy: '' }),
			}),
		).toThrow(/reviewer and a valid review timestamp/i);
	});
});
