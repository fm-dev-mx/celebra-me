import {
	assessEvidenceReuse,
	ineligibilityReason,
	REQUIRED_SOURCE_JOBS,
	type EvidenceRequest,
	type SourceRun,
} from '../../scripts/ops/ci-evidence-reuse.ts';

const HEAD_SHA = 'a'.repeat(40);
const TREE_SHA = 'b'.repeat(40);

const request: EvidenceRequest = {
	eventName: 'pull_request',
	repository: 'owner/repository',
	headRef: 'develop',
	headRepository: 'owner/repository',
	headSha: HEAD_SHA,
	headTreeSha: TREE_SHA,
	mergeTreeSha: TREE_SHA,
};

function sourceRun(overrides: Partial<SourceRun> = {}): SourceRun {
	return {
		id: 100,
		event: 'push',
		headBranch: 'develop',
		headSha: HEAD_SHA,
		headRepository: 'owner/repository',
		conclusion: 'success',
		jobs: REQUIRED_SOURCE_JOBS.map((name) => ({ name, conclusion: 'success' })),
		...overrides,
	};
}

describe('CI evidence reuse', () => {
	it('reuses a complete integration run when the merge candidate holds the same tree', () => {
		expect(assessEvidenceReuse(request, [sourceRun()])).toEqual({
			reuse: true,
			reason: `Tree ${TREE_SHA} was validated by integration run 100.`,
			sourceRunId: 100,
		});
	});

	it('prefers the newest qualifying run', () => {
		const decision = assessEvidenceReuse(request, [
			sourceRun({ id: 100 }),
			sourceRun({ id: 300, conclusion: 'failure' }),
			sourceRun({ id: 200 }),
		]);
		expect(decision.sourceRunId).toBe(200);
	});

	it.each([
		['another event', { eventName: 'push' }],
		['a head outside the integration branch', { headRef: 'dependabot/npm_and_yarn/example' }],
		['a head from another repository', { headRepository: 'fork/repository' }],
		['an abbreviated head SHA', { headSha: 'aaaaaaa' }],
		['a missing tree identity', { mergeTreeSha: '' }],
		['a merge candidate with a different tree', { mergeTreeSha: 'c'.repeat(40) }],
	])('declines %s', (_label, overrides) => {
		const decision = assessEvidenceReuse({ ...request, ...overrides }, [sourceRun()]);
		expect(decision.reuse).toBe(false);
		expect(decision.sourceRunId).toBeNull();
	});

	it.each([
		['no run', []],
		['a failed run', [sourceRun({ conclusion: 'failure' })]],
		['an unfinished run', [sourceRun({ conclusion: null })]],
		['a run for another commit', [sourceRun({ headSha: 'd'.repeat(40) })]],
		['a pull request run', [sourceRun({ event: 'pull_request' })]],
		['a run on another branch', [sourceRun({ headBranch: 'main' })]],
		['a run from another repository', [sourceRun({ headRepository: 'fork/repository' })]],
		[
			'a run that skipped a tier',
			[
				sourceRun({
					jobs: REQUIRED_SOURCE_JOBS.map((name) => ({
						name,
						conclusion: name === 'Application / browser' ? 'skipped' : 'success',
					})),
				}),
			],
		],
		[
			'a run missing a tier',
			[
				sourceRun({
					jobs: REQUIRED_SOURCE_JOBS.filter((name) => name !== 'Application / unit').map(
						(name) => ({ name, conclusion: 'success' }),
					),
				}),
			],
		],
	])('declines %s as integration evidence', (_label, runs) => {
		expect(assessEvidenceReuse(request, runs).reuse).toBe(false);
	});

	it('reports why a pull request is not a reuse candidate', () => {
		expect(ineligibilityReason(request)).toBeNull();
		expect(ineligibilityReason({ ...request, headRef: 'fix/example' })).toBe(
			'Pull request head is not develop.',
		);
		expect(ineligibilityReason({ ...request, repository: '', headRepository: '' })).toBe(
			'Pull request head is outside this repository.',
		);
	});
});
