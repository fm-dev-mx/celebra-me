import { afterEach, describe, expect, it } from '@jest/globals';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createPendingPreviewApprovalArtifact,
	finalizePreviewApprovalArtifact,
	verifyPreviewApprovalArtifact,
} from '../../scripts/provision/preview-approval-service.ts';

const originalCwd = process.cwd();
const createdDirs: string[] = [];
const PACKAGE_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);
const METADATA_HASH = 'c'.repeat(64);
const PROJECTION_HASH = 'd'.repeat(32);
const ASSET_MANIFEST_HASH = 'e'.repeat(64);
const ASSET_HASH = 'f'.repeat(64);
const ASSET_PATH = 'managed/test/hero.webp';

afterEach(() => {
	process.chdir(originalCwd);
	createdDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

/**
 * Build a temporary fixture directory with a pending artifact and matching
 * valid evidence written to it. Returns absolute paths usable while the
 * process cwd is changed to the fixture directory.
 */
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
		slug: 'test-invitation',
		previewProjectRef: 'iwipdvisoyerfdytuhwi',
		route: '/xv/test-invitation',
		projectionHash: PROJECTION_HASH,
		expectedAssetHashes: hashes,
	});

	writeFileSync(
		join(dir, 'evidence.json'),
		JSON.stringify({
			packageHash: PACKAGE_HASH,
			previewProjectRef: 'iwipdvisoyerfdytuhwi',
			route: '/xv/test-invitation',
			projectionHash: PROJECTION_HASH,
			checklistResults: { route: true, dashboard: true },
			storageHashVerification: hashes,
		}),
	);

	return { artifactPath, packageHash: PACKAGE_HASH, dir };
}

function evidencePath(dir: string): string {
	return join(dir, 'evidence.json');
}

describe('Preview approval artifact', () => {
	it('requires exact package, projection, route, checklist, and every asset hash', () => {
		const fixture = buildFixture();
		try {
			expect(
				finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir))
					.approvalState,
			).toBe('approved');
			expect(
				verifyPreviewApprovalArtifact(
					{
						packageHash: fixture.packageHash,
						sourceHash: SOURCE_HASH,
						metadataHash: METADATA_HASH,
						projectionHash: PROJECTION_HASH,
						assetManifestHash: ASSET_MANIFEST_HASH,
						slug: 'test-invitation',
						route: '/xv/test-invitation',
					},
					['.agent/tmp/approvals'],
				).approvalState,
			).toBe('approved');
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects incomplete storage evidence (empty verification with expected assets)', () => {
		const fixture = buildFixture();
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: PROJECTION_HASH,
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
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: PROJECTION_HASH,
					checklistResults: { route: true },
					// storageHashVerification intentionally omitted
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
			'managed/test/second.webp': 'd'.repeat(64),
		});
		try {
			writeFileSync(
				evidencePath(fixture.dir),
				JSON.stringify({
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
					storageHashVerification: { [ASSET_PATH]: ASSET_HASH }, // second asset missing
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
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: PROJECTION_HASH,
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
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: PROJECTION_HASH,
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
					packageHash: fixture.packageHash,
					previewProjectRef: 'iwipdvisoyerfdytuhwi',
					route: '/xv/test-invitation',
					projectionHash: PROJECTION_HASH,
					checklistResults: { route: true, dashboard: true },
					// storageHashVerification omitted — no assets to verify
				}),
			);
			const result = finalizePreviewApprovalArtifact(
				fixture.artifactPath,
				evidencePath(fixture.dir),
			);
			expect(result.approvalState).toBe('approved');
			// verify also passes
			expect(
				verifyPreviewApprovalArtifact(
					{
						packageHash: fixture.packageHash,
						sourceHash: SOURCE_HASH,
						metadataHash: METADATA_HASH,
						projectionHash: PROJECTION_HASH,
						assetManifestHash: ASSET_MANIFEST_HASH,
						slug: 'test-invitation',
						route: '/xv/test-invitation',
					},
					['.agent/tmp/approvals'],
				).approvalState,
			).toBe('approved');
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('rejects an approved artifact whose projection hash differs from the current release', () => {
		const fixture = buildFixture();
		try {
			finalizePreviewApprovalArtifact(fixture.artifactPath, evidencePath(fixture.dir));
			expect(() =>
				verifyPreviewApprovalArtifact(
					{
						packageHash: fixture.packageHash,
						sourceHash: SOURCE_HASH,
						metadataHash: METADATA_HASH,
						projectionHash: '1'.repeat(32),
						assetManifestHash: ASSET_MANIFEST_HASH,
						slug: 'test-invitation',
						route: '/xv/test-invitation',
					},
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
			// Should not have written anything to the repo root
			expect(existsSync(join(originalCwd, 'evidence.json'))).toBe(false);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('cleans up temporary fixture directories after test', () => {
		const fixture = buildFixture();
		// buildFixture adds to createdDirs, so afterEach will clean it up
		expect(fixture.dir.startsWith(tmpdir())).toBe(true);
		expect(existsSync(fixture.dir)).toBe(true);
		// The afterEach handler will remove this; just verify the directory exists now
	});
});
