import { describe, expect, it, jest } from '@jest/globals';
import { assertReleaseReadinessFailFast } from '../../scripts/db/production-release-readiness.ts';
import { REQUIRED_RELEASE_CHECKS } from '../../scripts/ops/release-readiness.ts';

const sha = 'c'.repeat(40);
const checks = (state: string) =>
	REQUIRED_RELEASE_CHECKS.map((name) => ({ name, sha, state, trusted: true }));

describe('Production apply release readiness', () => {
	it('stops on a still-running CI before the local release-check runs', () => {
		const calls: string[] = [];
		const ensureEvidence = jest.fn(() => {
			calls.push('release-check');
			return { sha };
		});
		expect(() =>
			assertReleaseReadinessFailFast(
				{ remote: true },
				{
					readCleanHeadSha: () => sha,
					loadChecks: () => {
						calls.push('remote');
						return checks('in_progress');
					},
					ensureEvidence,
				},
			),
		).toThrow(/Release checks pending/);
		expect(calls).toEqual(['remote']);
		expect(ensureEvidence).not.toHaveBeenCalled();
	});

	it('runs the local release-check after green remote checks for the same HEAD', () => {
		const calls: string[] = [];
		const result = assertReleaseReadinessFailFast(
			{ remote: true },
			{
				readCleanHeadSha: () => sha,
				loadChecks: () => {
					calls.push('remote');
					return checks('success');
				},
				ensureEvidence: () => {
					calls.push('release-check');
					return { sha };
				},
			},
		);
		expect(result).toEqual({ sha });
		expect(calls).toEqual(['remote', 'release-check']);
	});

	it('refuses evidence for a different HEAD than the one CI verified', () => {
		expect(() =>
			assertReleaseReadinessFailFast(
				{ remote: true },
				{
					readCleanHeadSha: () => sha,
					loadChecks: () => checks('success'),
					ensureEvidence: () => ({ sha: 'd'.repeat(40) }),
				},
			),
		).toThrow(/CI verificado para cccccccccccc, release-check para dddddddddddd/);
	});

	it('skips remote checks when the plan has no schema work', () => {
		const loadChecks = jest.fn(() => checks('in_progress'));
		const result = assertReleaseReadinessFailFast(
			{ remote: false },
			{ readCleanHeadSha: () => sha, loadChecks, ensureEvidence: () => ({ sha }) },
		);
		expect(result).toEqual({ sha });
		expect(loadChecks).not.toHaveBeenCalled();
	});
});
