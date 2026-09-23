import {
	CERTIFICATION_COMMAND_VERSION,
	CERTIFICATION_SCHEMA_VERSION,
	CERTIFIED_BROWSER_COMMAND,
	NODE_ARCHIVE_SHA256,
	NODE_VERSION,
	PNPM_VERSION,
	PLAYWRIGHT_IMAGE,
	certificationMatches,
	shouldRequireVisualCertification,
	visualDifferenceFiles,
} from '../../scripts/ops/visual-prepush-certification.ts';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const identity = {
	schemaVersion: CERTIFICATION_SCHEMA_VERSION,
	commandVersion: CERTIFICATION_COMMAND_VERSION,
	sha: 'a'.repeat(40),
	matrixHash: 'b'.repeat(64),
	acceptedManifestSha256: 'c'.repeat(64),
	lockfileSha256: 'd'.repeat(64),
	playwrightImage: PLAYWRIGHT_IMAGE,
	nodeVersion: NODE_VERSION,
	nodeArchiveSha256: NODE_ARCHIVE_SHA256,
	pnpmVersion: PNPM_VERSION,
	certifiedBrowserCommand: CERTIFIED_BROWSER_COMMAND,
	runtimeContractHash: 'e'.repeat(64),
};

describe('visual pre-push certification', () => {
	it('always requires a full certification for protected branches', () => {
		expect(shouldRequireVisualCertification('refs/heads/develop', [])).toBe(true);
		expect(shouldRequireVisualCertification('refs/heads/main', ['docs/readme.md'])).toBe(true);
	});

	it('requires feature-branch certification only for cumulative visual impact', () => {
		expect(
			shouldRequireVisualCertification('refs/heads/feature/example', ['src/styles/app.scss']),
		).toBe(true);
		expect(
			shouldRequireVisualCertification('refs/heads/feature/example', [
				'scripts/ops/ci-metrics.ts',
			]),
		).toBe(false);
	});

	it('fails closed when certification identity drifts or contains unknown fields', () => {
		const valid = { ...identity, certifiedAt: '2026-09-23T00:00:00.000Z' };
		expect(certificationMatches(valid, identity)).toBe(true);
		expect(certificationMatches({ ...valid, matrixHash: 'e'.repeat(64) }, identity)).toBe(
			false,
		);
		expect(certificationMatches({ ...valid, unexpected: true }, identity)).toBe(false);
	});

	it('reads visual differences only from structured comparison manifests', () => {
		const root = mkdtempSync(join(tmpdir(), 'visual-certification-test-'));
		const compare = join(root, 'visual-parity', 'compare');
		mkdirSync(compare, { recursive: true });
		writeFileSync(
			join(compare, 'manifest.json'),
			JSON.stringify({
				captures: [
					{ file: 'variant-pass.png', comparisonResult: 'PASS' },
					{ file: 'variant-fail.png', comparisonResult: 'FAIL' },
				],
			}),
		);
		writeFileSync(
			join(compare, 'pages-manifest.json'),
			JSON.stringify({
				captures: [{ file: 'pages/page-fail.png', comparisonResult: 'FAIL' }],
			}),
		);
		try {
			expect(visualDifferenceFiles(root)).toEqual([
				'pages/page-fail.png',
				'variant-fail.png',
			]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
