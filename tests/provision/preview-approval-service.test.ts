import { afterEach, describe, expect, it } from '@jest/globals';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createPendingPreviewApprovalArtifact,
	finalizePreviewApprovalArtifact,
	PREVIEW_APPROVAL_SCHEMA_VERSION,
	verifyPreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';

const originalCwd = process.cwd();
const createdDirs: string[] = [];
const PACKAGE_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);
const METADATA_HASH = 'c'.repeat(64);
/** Canonical package projection (environment-neutral content). */
const CANONICAL_PROJECTION_HASH = 'd'.repeat(32);
/**
 * Preview-materialized projection — differs because Preview embeds environment-specific
 * asset IDs/URLs that are absent from the canonical package projection.
 */
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

afterEach(() => {
	process.chdir(originalCwd);
	createdDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function buildFixture(expectedAssetHashes?: Record<string, string>): {
	artifactPath: string;
	packageHash: string;
	dir: string;
} {
	const dir = mkdtempSync(join(tmpdir(), 'celebra-approval-'));
	createdDirs.push(dir);
	process.chdir(dir);

	const hashes = expectedAssetHashes ?? { [ASSET_PATH]: ASSET_HASH };
	const artifactPath = createPendingPreviewApprovalArtifact({
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
		expectedAssetHashes: hashes,
	});

	writeFileSync(
		join(dir, 'evidence.json'),
		JSON.stringify({
			...BASE_REVIEW_EVIDENCE,
			packageHash: PACKAGE_HASH,
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/xv/test-invitation',
			projectionHash: MATERIALIZED_PROJECTION_HASH,
			checklistResults: { route: true, dashboard: true },
			storageHashVerification: hashes,
		}),
	);

	return { artifactPath, packageHash: PACKAGE_HASH, dir };
}

function evidencePath(dir: string): string {
	return join(dir, 'evidence.json');
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

describe('Preview approval artifact', () => {
	it('keeps canonical and Preview-materialized projection hashes distinct when asset IDs differ', () => {
		expect(CANONICAL_PROJECTION_HASH).not.toBe(MATERIALIZED_PROJECTION_HASH);
		const fixture = buildFixture();
		try {
			const pending = JSON.parse(readFileSync(fixture.artifactPath, 'utf8')) as {
				schemaVersion: string;
				canonicalProjectionHash: string;
				materializedProjectionHash: string;
			};
			expect(pending.schemaVersion).toBe(PREVIEW_APPROVAL_SCHEMA_VERSION);
			expect(pending.canonicalProjectionHash).toBe(CANONICAL_PROJECTION_HASH);
			expect(pending.materializedProjectionHash).toBe(MATERIALIZED_PROJECTION_HASH);
			expect(pending.canonicalProjectionHash).not.toBe(pending.materializedProjectionHash);

			expect(
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir))
					.approvalState,
			).toBe('approved');
			const approved = verifyPreviewApprovalArtifact(productionIdentity(), [
				'.agent/tmp/approvals',
			]);
			expect(approved.canonicalProjectionHash).toBe(CANONICAL_PROJECTION_HASH);
			expect(approved.hostedValidation?.projectionHash).toBe(MATERIALIZED_PROJECTION_HASH);
			expect(approved.hostedValidation?.projectionHash).not.toBe(
				approved.canonicalProjectionHash,
			);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('finalizes against materialized Preview hash and verifies Production against canonical hash', () => {
		const fixture = buildFixture();
		try {
			expect(
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir))
					.approvalState,
			).toBe('approved');
			expect(
				verifyPreviewApprovalArtifact(productionIdentity(), ['.agent/tmp/approvals'])
					.approvalState,
			).toBe('approved');
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects hosted evidence bound to the canonical hash instead of the materialized hash', () => {
		const fixture = buildFixture();
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: CANONICAL_PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
					storageHashVerification: { [ASSET_PATH]: ASSET_HASH },
				}),
			);
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/does not satisfy the pending approval artifact/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects Production identity that supplies the materialized hash as the canonical projection', () => {
		const fixture = buildFixture();
		try {
			finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir));
			expect(() =>
				verifyPreviewApprovalArtifact(
					productionIdentity({ projectionHash: MATERIALIZED_PROJECTION_HASH }),
					['.agent/tmp/approvals'],
				),
			).toThrow(/exact release hashes/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('invalidates obsolete single-projectionHash artifacts instead of migrating them', () => {
		const dir = mkdtempSync(join(tmpdir(), 'celebra-approval-old-'));
		createdDirs.push(dir);
		process.chdir(dir);
		mkdirSync(join(dir, '.agent/tmp/approvals'), { recursive: true });
		const path = join(
			dir,
			'.agent/tmp/approvals',
			`preview-approval-${PACKAGE_HASH.slice(0, 16)}.json`,
		);
		writeFileSync(
			path,
			JSON.stringify({
				schemaVersion: '2.0.0',
				approvalState: 'approved',
				packageHash: PACKAGE_HASH,
				sourceHash: SOURCE_HASH,
				metadataHash: METADATA_HASH,
				projectionHash: CANONICAL_PROJECTION_HASH,
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
			}),
		);
		expect(() =>
			verifyPreviewApprovalArtifact(productionIdentity(), ['.agent/tmp/approvals']),
		).toThrow(/obsolete contract/i);

		const regenerated = createPendingPreviewApprovalArtifact({
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
			expectedAssetHashes: {},
		});
		const rewritten = JSON.parse(readFileSync(regenerated, 'utf8')) as {
			approvalState: string;
			schemaVersion: string;
		};
		expect(rewritten.approvalState).toBe('pending_hosted_validation');
		expect(rewritten.schemaVersion).toBe(PREVIEW_APPROVAL_SCHEMA_VERSION);
		process.chdir(originalCwd);
	});

	it('rejects incomplete storage evidence (empty verification with expected assets)', () => {
		const fixture = buildFixture();
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: MATERIALIZED_PROJECTION_HASH,
					checklistResults: { route: true },
					storageHashVerification: {},
				}),
			);
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/missing storage hash verification for asset/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects missing storageHashVerification', () => {
		const fixture = buildFixture();
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: MATERIALIZED_PROJECTION_HASH,
					checklistResults: { route: true },
				}),
			);
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/missing required storage hash verification/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects one missing asset when multiple are expected', () => {
		const fixture = buildFixture({
			[ASSET_PATH]: ASSET_HASH,
			'managed/test/second.webp': '2'.repeat(64),
		});
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: MATERIALIZED_PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
					storageHashVerification: { [ASSET_PATH]: ASSET_HASH },
				}),
			);
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/missing storage hash verification for asset/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects incorrect asset hash', () => {
		const fixture = buildFixture();
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: MATERIALIZED_PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
					storageHashVerification: { [ASSET_PATH]: 'wronghashvalue' },
				}),
			);
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/storage hash mismatch for asset/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects malformed storageHashVerification (non-object)', () => {
		const fixture = buildFixture();
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: MATERIALIZED_PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
					storageHashVerification: 'not-an-object',
				}),
			);
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/missing required storage hash verification/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('allows finalization when no expected assets exist', () => {
		const fixture = buildFixture({});
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					...BASE_REVIEW_EVIDENCE,
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: MATERIALIZED_PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
				}),
			);
			const result = finalizePreviewApprovalArtifact(
				fixture.artifactPath,
				evidencePath(fixture.dir),
			);
			expect(result.approvalState).toBe('approved');
			expect(
				verifyPreviewApprovalArtifact(productionIdentity(), ['.agent/tmp/approvals'])
					.approvalState,
			).toBe('approved');
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects an approved artifact whose canonical projection differs from the current release', () => {
		const fixture = buildFixture();
		try {
			finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir));
			expect(() =>
				verifyPreviewApprovalArtifact(
					productionIdentity({ projectionHash: '9'.repeat(32) }),
					['.agent/tmp/approvals'],
				),
			).toThrow(/exact release hashes/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('does not leave evidence files at the repository root', () => {
		const fixture = buildFixture();
		try {
			finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir));
			expect(existsSync(join(originalCwd, 'evidence.json'))).toBe(false);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects approval evidence whose executed Preview plan ID does not match', () => {
		const fixture = buildFixture();
		try {
			const evidence = JSON.parse(readFileSync(evidencePath(fixture.dir), 'utf8')) as Record<
				string,
				unknown
			>;
			evidence.planId = 'different-preview-plan';
			writeFileSync(evidencePath(fixture.dir), JSON.stringify(evidence));
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/executed Preview plan/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects approval evidence without reviewer identity or timestamp', () => {
		const fixture = buildFixture();
		try {
			const evidence = JSON.parse(readFileSync(evidencePath(fixture.dir), 'utf8')) as Record<
				string,
				unknown
			>;
			delete evidence.reviewedBy;
			writeFileSync(evidencePath(fixture.dir), JSON.stringify(evidence));
			expect(() =>
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir)),
			).toThrow(/reviewer and a valid review timestamp/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects a stale approved artifact', () => {
		const fixture = buildFixture();
		try {
			finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir));
			const artifact = JSON.parse(readFileSync(fixture.artifactPath, 'utf8')) as Record<
				string,
				unknown
			>;
			artifact.approvedAt = '2026-06-01T00:00:00.000Z';
			writeFileSync(fixture.artifactPath, JSON.stringify(artifact));
			expect(() =>
				verifyPreviewApprovalArtifact(
					{
						...productionIdentity(),
						planId: PLAN_ID,
						intendedProductionProjectRef: 'productionproject',
					},
					['.agent/tmp/approvals'],
					new Date('2026-07-23T00:00:00.000Z'),
				),
			).toThrow(/stale/i);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects an approval intended for a different Production project', () => {
		const fixture = buildFixture();
		try {
			finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir));
			expect(() =>
				verifyPreviewApprovalArtifact(
					{
						...productionIdentity(),
						planId: PLAN_ID,
						intendedProductionProjectRef: 'anotherproject',
					},
					['.agent/tmp/approvals'],
				),
			).toThrow(/stale, incomplete, or does not match/i);
		} finally {
			process.chdir(originalCwd);
		}
	});
});
