import {
	classifyCheck,
	classifyDeployment,
	collectReleaseStatus,
	loadDeploymentForSha,
	loadIgnoredPreviewBuild,
	probeHealth,
	waitForReleaseStatus,
	type ReleaseStatus,
} from '../../scripts/ops/release-status.ts';
import {
	PREVIEW_DEPLOYMENT_SMOKE,
	PRODUCTION_DEPLOYMENT_SMOKE,
	REQUIRED_RELEASE_CHECKS,
} from '../../scripts/ops/release-readiness.ts';

const sha = 'a'.repeat(40);
const previewUrl = 'https://celebra-abc123-francisco-mendoza-s-projects.vercel.app';
const productionUrl = 'https://celebra-ar4swgfjq-francisco-mendoza-s-projects.vercel.app';
const vercelCreator = { login: 'vercel[bot]' };

function ghRunner(responses: Record<string, unknown>): (args: string[]) => string {
	return (args) => {
		if (args[0] === 'repo') return 'celebra-me/test\n';
		const key = args[1]?.replace('repos/celebra-me/test/', '') ?? '';
		if (!(key in responses)) throw new Error(`Unexpected GitHub API request: ${key}`);
		return JSON.stringify(responses[key]);
	};
}

function checkRuns(states: Record<string, string>) {
	return {
		total_count: Object.keys(states).length,
		check_runs: Object.entries(states).map(([name, state], index) => ({
			id: index + 1,
			name,
			head_sha: sha,
			status: state === 'in_progress' ? 'in_progress' : 'completed',
			conclusion: state === 'in_progress' ? null : state,
			app: { id: 15368 },
		})),
	};
}

function responses(states: Record<string, string>, deploymentState = 'success') {
	return {
		'check-runs?filter=latest&per_page=100': checkRuns(states),
		[`commits/${sha}/check-runs?filter=latest&per_page=100`]: checkRuns(states),
		[`commits/${sha}/statuses?per_page=100`]: [],
		[`deployments?sha=${sha}&per_page=100`]: [
			{ id: 7, sha, environment: 'Preview' },
			{ id: 3, sha, environment: 'Production' },
		],
		'deployments/7/statuses?per_page=100': [
			{ state: deploymentState, environment_url: previewUrl },
		],
	};
}

const allPassed = Object.fromEntries(REQUIRED_RELEASE_CHECKS.map((name) => [name, 'success']));
const healthy = (commitSha: string | null) => async () => ({
	status: 200,
	json: async () => ({ status: 'healthy', build: commitSha ? { commitSha } : undefined }),
});

describe('release status classification', () => {
	it('separates pending, passed and failed checks', () => {
		expect(classifyCheck(sha, undefined)).toBe('pending');
		expect(classifyCheck(sha, { name: 'x', sha, state: 'in_progress', trusted: true })).toBe(
			'pending',
		);
		expect(classifyCheck(sha, { name: 'x', sha, state: 'success', trusted: true })).toBe(
			'passed',
		);
		expect(classifyCheck(sha, { name: 'x', sha, state: 'success', trusted: false })).toBe(
			'failed',
		);
		expect(classifyCheck(sha, { name: 'x', sha, state: 'cancelled', trusted: true })).toBe(
			'failed',
		);
	});

	it('requires an immutable Preview host for a ready deployment', () => {
		const ready = { id: 1, environment: 'Preview', state: 'success', url: previewUrl };
		expect(classifyDeployment('preview', ready)).toBe('passed');
		expect(classifyDeployment('preview', { ...ready, url: 'https://example.vercel.app' })).toBe(
			'failed',
		);
		expect(classifyDeployment('preview', { ...ready, state: 'in_progress' })).toBe('pending');
		expect(classifyDeployment('preview', { ...ready, state: 'failure' })).toBe('failed');
	});

	it('correlates the serving build with the release SHA', async () => {
		expect((await probeHealth(previewUrl, sha, healthy(sha))).result).toBe('match');
		expect((await probeHealth(previewUrl, sha, healthy('b'.repeat(40)))).result).toBe(
			'mismatch',
		);
		expect((await probeHealth(previewUrl, sha, healthy(null))).result).toBe('unreported');
		expect(
			(
				await probeHealth(previewUrl, sha, async () => {
					throw new Error('offline');
				})
			).result,
		).toBe('unreachable');
	});
});

describe('collectReleaseStatus', () => {
	it('verifies checks, the Preview deployment, its smoke and health in one result', async () => {
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run: ghRunner(responses({ ...allPassed, [PREVIEW_DEPLOYMENT_SMOKE]: 'success' })),
			fetchImpl: healthy(sha),
		});
		expect(status.state).toBe('VERIFIED');
		expect(status.deployment).toMatchObject({ id: 7, url: previewUrl });
		expect(status.health[0].result).toBe('match');
		expect(status.blockers).toEqual([]);
	});

	describe('ignored Preview build', () => {
		const skipped = (extra: Record<string, unknown>[] = []) => ({
			[`commits/${sha}/statuses?per_page=100`]: [
				...extra,
				{
					context: 'Vercel',
					state: 'success',
					description: 'Canceled by Ignored Build Step',
					creator: vercelCreator,
				},
			],
			[`deployments?sha=${sha}&per_page=100`]: [],
		});

		it('reports SKIPPED when CI passed and Vercel skipped the build', async () => {
			const status = await collectReleaseStatus(sha, 'preview', 'ci', {
				run: ghRunner({ ...responses(allPassed), ...skipped() }),
				fetchImpl: healthy(sha),
			});
			expect(status.state).toBe('SKIPPED');
			expect(status.ignoredBuild).toEqual({ description: 'Canceled by Ignored Build Step' });
			expect(status.deployment).toBeNull();
			expect(status.blockers).toEqual([]);
		});

		it('never skips past a failed or pending required check', async () => {
			const failed = await collectReleaseStatus(sha, 'preview', 'ci', {
				run: ghRunner({
					...responses({ ...allPassed, 'Application Suite': 'failure' }),
					...skipped(),
				}),
			});
			expect(failed.state).toBe('FAILED');
			const pending = await collectReleaseStatus(sha, 'preview', 'ci', {
				run: ghRunner({
					...responses({ ...allPassed, 'Application Suite': 'in_progress' }),
					...skipped(),
				}),
			});
			expect(pending.state).toBe('PENDING');
		});

		it('ignores a skip superseded by a newer build, a foreign creator and Production', () => {
			const deploying = {
				context: 'Vercel',
				state: 'pending',
				description: 'Vercel is deploying your app',
				creator: vercelCreator,
			};
			const run = (extra: Record<string, unknown>[]) =>
				ghRunner({ ...responses(allPassed), ...skipped(extra) });
			expect(loadIgnoredPreviewBuild(sha, run([deploying]))).toBeNull();
			expect(
				loadIgnoredPreviewBuild(
					sha,
					ghRunner({
						...responses(allPassed),
						[`commits/${sha}/statuses?per_page=100`]: [
							{
								context: 'Vercel',
								state: 'success',
								description: 'Canceled by Ignored Build Step',
								creator: { login: 'someone' },
							},
						],
					}),
				),
			).toBeNull();
		});

		it('does not apply to Production', async () => {
			const status = await collectReleaseStatus(sha, 'production', 'ci', {
				run: ghRunner({ ...responses(allPassed), ...skipped() }),
			});
			expect(status.ignoredBuild).toBeNull();
			expect(status.state).not.toBe('SKIPPED');
		});
	});

	it('stays pending while CI or the smoke is still running', async () => {
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run: ghRunner(responses({ ...allPassed, 'Application Suite': 'in_progress' })),
			fetchImpl: healthy(sha),
		});
		expect(status.state).toBe('PENDING');
		expect(status.blockers).toEqual(
			expect.arrayContaining([
				'Application Suite: in_progress',
				`${PREVIEW_DEPLOYMENT_SMOKE}: missing`,
			]),
		);
	});

	it('verifies Production from the Vercel deployment when a workflow environment record is newer', async () => {
		// Observed for a Production SHA: Vercel records the deployment, then the Post-deploy Smoke
		// job (`environment: Production`) records a newer deployment with an empty environment_url
		// that GitHub also attributes to vercel[bot].
		const run = ghRunner({
			...responses({ ...allPassed, [PRODUCTION_DEPLOYMENT_SMOKE]: 'success' }),
			[`deployments?sha=${sha}&per_page=100`]: [
				{ id: 6927490534, sha, environment: 'Production', creator: vercelCreator },
				{ id: 6927490121, sha, environment: 'Production', creator: vercelCreator },
			],
			'deployments/6927490534/statuses?per_page=100': [
				{ state: 'success', environment_url: '' },
				{ state: 'in_progress', environment_url: '' },
			],
			'deployments/6927490121/statuses?per_page=100': [
				{ state: 'success', environment_url: productionUrl },
			],
		});
		expect(loadDeploymentForSha(sha, 'production', run)).toEqual({
			id: 6927490121,
			environment: 'Production',
			state: 'success',
			url: productionUrl,
		});
		const probes: Array<{ url: string; headers?: Record<string, string> }> = [];
		const protectionHeaders = { 'x-vercel-protection-bypass': 'test-bypass' };
		const status = await collectReleaseStatus(sha, 'production', 'ci', {
			run,
			protectionHeaders,
			fetchImpl: async (url, init) => {
				probes.push({ url, headers: init?.headers });
				return healthy(sha)();
			},
		});
		expect(status.state).toBe('VERIFIED');
		expect(status.deployment).toMatchObject({ id: 6927490121, url: productionUrl });
		expect(status.health.map((entry) => entry.result)).toEqual(['match', 'match']);
		expect(status.blockers).toEqual([]);
		// Vercel Authentication guards the immutable Production URL; the public alias needs no bypass.
		expect(probes).toEqual([
			{ url: `${productionUrl}/api/health`, headers: protectionHeaders },
			{ url: 'https://www.celebra-me.com/api/health', headers: undefined },
		]);
	});

	it('verifies Preview from the record with an environment_url behind newer smoke records', async () => {
		// Observed for a Preview SHA: two newer vercel[bot] records with an empty environment_url.
		const run = ghRunner({
			...responses({ ...allPassed, [PREVIEW_DEPLOYMENT_SMOKE]: 'success' }),
			[`deployments?sha=${sha}&per_page=100`]: [
				{ id: 6927513471, sha, environment: 'Preview', creator: vercelCreator },
				{ id: 6927617721, sha, environment: 'Preview', creator: vercelCreator },
				{ id: 6927513812, sha, environment: 'Preview', creator: vercelCreator },
			],
			'deployments/6927617721/statuses?per_page=100': [
				{ state: 'success', environment_url: '' },
			],
			'deployments/6927513812/statuses?per_page=100': [
				{ state: 'success', environment_url: '' },
			],
			'deployments/6927513471/statuses?per_page=100': [
				{ state: 'success', environment_url: previewUrl },
			],
		});
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run,
			fetchImpl: healthy(sha),
		});
		expect(status.state).toBe('VERIFIED');
		expect(status.deployment).toMatchObject({ id: 6927513471, url: previewUrl });
	});

	it('falls back to the newest deployment record while no candidate has an environment_url', () => {
		const run = ghRunner({
			[`deployments?sha=${sha}&per_page=100`]: [
				{ id: 11, sha, environment: 'Production', creator: vercelCreator },
				{ id: 10, sha, environment: 'Production', creator: vercelCreator },
				{ id: 9, sha, environment: 'Preview', creator: vercelCreator },
			],
			'deployments/11/statuses?per_page=100': [],
			'deployments/10/statuses?per_page=100': [{ state: 'in_progress' }],
		});
		expect(loadDeploymentForSha(sha, 'production', run)).toEqual({
			id: 11,
			environment: 'Production',
			state: 'pending',
			url: null,
		});
	});

	it('fails on a failed check or a serving build from another SHA', async () => {
		const failed = await collectReleaseStatus(sha, 'preview', 'skip', {
			run: ghRunner(responses({ ...allPassed, 'Repository Policy': 'failure' })),
			fetchImpl: healthy(sha),
		});
		expect(failed.state).toBe('FAILED');
		const mismatch = await collectReleaseStatus(sha, 'preview', 'skip', {
			run: ghRunner(responses(allPassed)),
			fetchImpl: healthy('b'.repeat(40)),
		});
		expect(mismatch.state).toBe('FAILED');
	});
});

describe('waitForReleaseStatus', () => {
	const status = (state: ReleaseStatus['state']) => ({ state }) as ReleaseStatus;

	it('polls until a terminal state', async () => {
		const results = [status('PENDING'), status('PENDING'), status('VERIFIED')];
		const sleep = jest.fn(async () => undefined);
		const result = await waitForReleaseStatus(async () => results.shift()!, {
			timeoutMs: 60_000,
			intervalMs: 1_000,
			sleep,
			now: () => 0,
		});
		expect(result.state).toBe('VERIFIED');
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('reports a timeout as pending instead of success', async () => {
		let clock = 0;
		const result = await waitForReleaseStatus(async () => status('PENDING'), {
			timeoutMs: 3_000,
			intervalMs: 1_000,
			sleep: async (ms) => {
				clock += ms;
			},
			now: () => clock,
		});
		expect(result.state).toBe('PENDING');
	});
});
