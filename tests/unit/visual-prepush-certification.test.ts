import {
	CERTIFICATION_COMMAND_VERSION,
	CERTIFICATION_SCHEMA_VERSION,
	PLAYWRIGHT_IMAGE,
	certificationMatches,
	shouldRequireVisualCertification,
} from '../../scripts/ops/visual-prepush-certification.ts';

const identity = {
	schemaVersion: CERTIFICATION_SCHEMA_VERSION,
	commandVersion: CERTIFICATION_COMMAND_VERSION,
	sha: 'a'.repeat(40),
	matrixHash: 'b'.repeat(64),
	acceptedManifestSha256: 'c'.repeat(64),
	lockfileSha256: 'd'.repeat(64),
	playwrightImage: PLAYWRIGHT_IMAGE,
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
});
