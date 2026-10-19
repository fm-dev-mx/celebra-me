import {
	classifyCheck,
	classifyDeployment,
	collectReleaseStatus,
	loadDeploymentForSha,
	probeHealth,
	waitForReleaseStatus,
	type ReleaseStatus,
} from '../../scripts/ops/release-status.ts';
import {
	CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE,
	CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE,
	REQUIRED_RELEASE_CHECKS,
} from '../../scripts/ops/release-readiness.ts';

const sha = 'a'.repeat(40);
const cloudflareVersionUrl = 'https://1a2b3c4d-celebra-me-preview.celebra-me-com.workers.dev';
const previewUrl = cloudflareVersionUrl;
const productionUrl = 'https://9f8e7d6c-celebra-me.celebra-me-com.workers.dev';
const workerCreator = { login: 'github-actions[bot]' };

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
const healthy =
	(commitSha: string | null, environment: string | null = 'preview') =>
	async () => ({
		status: 200,
		json: async () => ({
			status: 'healthy',
			build: commitSha ? { commitSha, environment } : undefined,
		}),
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

	it('requires a Cloudflare Preview Worker host for a ready deployment', () => {
		const ready = { id: 1, environment: 'Preview', state: 'success', url: previewUrl };
		expect(classifyDeployment('preview', ready)).toBe('passed');
		expect(classifyDeployment('preview', { ...ready, url: 'https://example.com' })).toBe(
			'failed',
		);
		expect(classifyDeployment('preview', { ...ready, state: 'in_progress' })).toBe('pending');
		expect(classifyDeployment('preview', { ...ready, state: 'failure' })).toBe('failed');
	});

	it('accepts the Cloudflare Preview Worker host and its version URLs', () => {
		const ready = {
			id: 1,
			environment: 'Preview',
			state: 'success',
			url: cloudflareVersionUrl,
		};
		expect(classifyDeployment('preview', ready)).toBe('passed');
		expect(
			classifyDeployment('preview', {
				...ready,
				url: 'https://celebra-me-preview.celebra-me-com.workers.dev',
			}),
		).toBe('passed');
		expect(
			classifyDeployment('preview', {
				...ready,
				url: 'https://other.celebra-me-com.workers.dev',
			}),
		).toBe('failed');
	});

	it('correlates the serving build with the release SHA', async () => {
		expect(
			(await probeHealth(previewUrl, sha, healthy(sha), undefined, 'preview')).result,
		).toBe('match');
		expect(
			(await probeHealth(previewUrl, sha, healthy('b'.repeat(40)), undefined, 'preview'))
				.result,
		).toBe('mismatch');
		expect(
			(await probeHealth(previewUrl, sha, healthy(null), undefined, 'preview')).result,
		).toBe('unreported');
		expect(
			(await probeHealth(previewUrl, sha, healthy(sha, null), undefined, 'preview')).result,
		).toBe('mismatch');
		expect(
			(await probeHealth(previewUrl, sha, healthy(sha), undefined, 'production')).result,
		).toBe('mismatch');
		// A failed database check answers 503 with the build identity; it is never a match.
		const databaseDown = await probeHealth(
			previewUrl,
			sha,
			async () => ({
				status: 503,
				json: async () => ({
					status: 'unhealthy',
					build: { commitSha: sha, environment: 'preview' },
				}),
			}),
			undefined,
			'preview',
		);
		expect(databaseDown).toMatchObject({ status: 503, commitSha: sha, result: 'unreachable' });
		expect(
			(
				await probeHealth(
					previewUrl,
					sha,
					async () => {
						throw new Error('offline');
					},
					undefined,
					'preview',
				)
			).result,
		).toBe('unreachable');
	});
});

describe('collectReleaseStatus', () => {
	it('verifies checks, the Preview deployment, its smoke and health in one result', async () => {
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run: ghRunner(
				responses({ ...allPassed, [CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE]: 'success' }),
			),
			fetchImpl: healthy(sha),
		});
		expect(status.state).toBe('VERIFIED');
		expect(status.deployment).toMatchObject({ id: 7, url: previewUrl });
		expect(status.health[0].result).toBe('match');
		expect(status.blockers).toEqual([]);
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
				`${CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE}: missing`,
			]),
		);
	});

	it('verifies Production from checks, its smoke and the public alias, ignoring legacy deployment records', async () => {
		// The retired hosting provider left Production deployment records on GitHub, some failed.
		const run = ghRunner({
			...responses({ ...allPassed, [CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE]: 'success' }),
			[`deployments?sha=${sha}&per_page=100`]: [{ id: 3, sha, environment: 'Production' }],
			'deployments/3/statuses?per_page=100': [{ state: 'failure', environment_url: '' }],
		});
		const probes: Array<{ url: string; headers?: Record<string, string> }> = [];
		const accessHeaders = { 'CF-Access-Client-Id': 'id', 'CF-Access-Client-Secret': 'secret' };
		const status = await collectReleaseStatus(sha, 'production', 'ci', {
			run,
			accessHeaders,
			fetchImpl: async (url, init) => {
				probes.push({ url, headers: init?.headers });
				return healthy(sha, 'production')();
			},
		});
		expect(status.state).toBe('VERIFIED');
		expect(status.deployment).toBeNull();
		expect(status.checks.map((check) => check.progress)).toEqual(
			REQUIRED_RELEASE_CHECKS.map(() => 'passed'),
		);
		expect(status.smoke).toMatchObject({
			name: CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE,
			progress: 'passed',
		});
		expect(status.blockers).toEqual([]);
		// The public alias needs no Access credential.
		expect(probes).toEqual([
			{ url: 'https://www.celebra-me.com/api/health', headers: undefined },
		]);
	});

	it('keeps Production pending without its domain smoke or Repository CI on the main SHA', async () => {
		const status = await collectReleaseStatus(sha, 'production', 'ci', {
			run: ghRunner(responses({})),
			fetchImpl: healthy(sha, 'production'),
		});
		expect(status.state).toBe('PENDING');
		expect(status.blockers).toEqual([
			...REQUIRED_RELEASE_CHECKS.map((name) => `${name}: missing`),
			`${CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE}: missing`,
		]);
	});

	it('verifies a Cloudflare Preview deployment with its own smoke and Access headers', async () => {
		const run = ghRunner({
			...responses({
				...allPassed,
				[CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE]: 'success',
			}),
			'deployments/7/statuses?per_page=100': [
				{ state: 'success', environment_url: cloudflareVersionUrl },
			],
		});
		const probes: Array<{ url: string; headers?: Record<string, string> }> = [];
		const accessHeaders = { 'CF-Access-Client-Id': 'id', 'CF-Access-Client-Secret': 'secret' };
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run,
			accessHeaders,
			fetchImpl: async (url, init) => {
				probes.push({ url, headers: init?.headers });
				return healthy(sha)();
			},
		});
		expect(status.state).toBe('VERIFIED');
		expect(status.smoke).toMatchObject({
			name: CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE,
			progress: 'passed',
		});
		expect(probes).toEqual([
			{ url: `${cloudflareVersionUrl}/api/health`, headers: accessHeaders },
		]);
	});

	it('reports a pending smoke while no deployment is recorded', async () => {
		const run = ghRunner({
			...responses({ ...allPassed, [CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE]: 'in_progress' }),
			[`deployments?sha=${sha}&per_page=100`]: [],
		});
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run,
			fetchImpl: healthy(sha),
		});
		expect(status.state).toBe('PENDING');
		expect(status.smoke).toMatchObject({
			name: CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE,
			progress: 'pending',
		});
	});

	it('verifies Preview from the record with an environment_url behind newer smoke records', async () => {
		// Observed for a Preview SHA: two newer workflow records with an empty environment_url.
		const run = ghRunner({
			...responses({ ...allPassed, [CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE]: 'success' }),
			[`deployments?sha=${sha}&per_page=100`]: [
				{ id: 6927513471, sha, environment: 'Preview', creator: workerCreator },
				{ id: 6927617721, sha, environment: 'Preview', creator: workerCreator },
				{ id: 6927513812, sha, environment: 'Preview', creator: workerCreator },
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
				{ id: 11, sha, environment: 'Production', creator: workerCreator },
				{ id: 10, sha, environment: 'Production', creator: workerCreator },
				{ id: 9, sha, environment: 'Preview', creator: workerCreator },
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

describe('smoke re-run', () => {
	// Observed shape: the deploy workflow publishes the smoke as a commit status whose target_url
	// links to its run; the run's head_sha need not be the release SHA.
	const runId = 37714189056;
	const targetUrl = `https://github.com/fm-dev-mx/celebra-me/actions/runs/${runId}/job/113112233445`;
	const smokeStatus = (state: string, createdAt: string) => ({
		context: CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE,
		state,
		description: null,
		target_url: targetUrl,
		created_at: createdAt,
		updated_at: createdAt,
		creator: { login: 'github-actions[bot]' },
	});
	const workflowRun = (status: string, attempt: number, conclusion: string | null) => ({
		id: runId,
		name: 'Cloudflare Preview Deploy',
		event: 'push',
		display_title: 'Cloudflare Preview Deploy',
		head_branch: 'main',
		head_sha: 'c'.repeat(40),
		status,
		conclusion,
		run_attempt: attempt,
		run_started_at: '2026-10-08T01:45:02Z',
	});
	const failedAttempt = [
		smokeStatus('failure', '2026-10-08T01:43:47Z'),
		smokeStatus('pending', '2026-10-08T01:42:16Z'),
	];
	const run = (statuses: unknown[], workflow: unknown) =>
		ghRunner({
			...responses(allPassed),
			[`commits/${sha}/statuses?per_page=100`]: statuses,
			[`actions/runs/${runId}`]: workflow,
		});

	it('keeps waiting while attempt 2 of the failed smoke run is running, then passes', async () => {
		const sequence = [
			run(failedAttempt, workflowRun('queued', 2, null)),
			run(failedAttempt, workflowRun('in_progress', 2, null)),
			run(
				[smokeStatus('success', '2026-10-08T01:49:10Z'), ...failedAttempt],
				workflowRun('completed', 2, 'success'),
			),
		];
		const observed: ReleaseStatus[] = [];
		const sleep = jest.fn(async () => undefined);
		const result = await waitForReleaseStatus(
			async () => {
				const status = await collectReleaseStatus(sha, 'preview', 'ci', {
					run: sequence.shift()!,
					fetchImpl: healthy(sha),
				});
				observed.push(status);
				return status;
			},
			{ timeoutMs: 60_000, intervalMs: 1_000, sleep, now: () => 0 },
		);
		expect(observed.map((status) => status.state)).toEqual(['PENDING', 'PENDING', 'VERIFIED']);
		expect(observed[0].smoke).toMatchObject({
			state: 'rerun queued',
			progress: 'pending',
			rerun: { runId, attempt: 2, status: 'queued' },
		});
		expect(observed[1].blockers).toEqual([
			`${CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE}: rerun in_progress`,
		]);
		expect(result.state).toBe('VERIFIED');
		expect(result.smoke.rerun).toBeUndefined();
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('fails on a completed smoke failure with no newer attempt', async () => {
		const result = await waitForReleaseStatus(
			() =>
				collectReleaseStatus(sha, 'preview', 'ci', {
					run: run(failedAttempt, workflowRun('completed', 1, 'failure')),
					fetchImpl: healthy(sha),
				}),
			{ timeoutMs: 60_000, intervalMs: 1_000, sleep: async () => undefined, now: () => 0 },
		);
		expect(result.state).toBe('FAILED');
		expect(result.smoke).toMatchObject({ state: 'failure', progress: 'failed' });
		expect(result.smoke.rerun).toBeUndefined();
	});

	it('ignores an untrusted smoke status even when its linked run is active', async () => {
		const forged = failedAttempt.map((entry) => ({ ...entry, creator: { login: 'someone' } }));
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run: run(forged, workflowRun('in_progress', 2, null)),
			fetchImpl: healthy(sha),
		});
		expect(status.state).toBe('FAILED');
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

describe('deployment URL behind Cloudflare Access', () => {
	const aliasHealthUrl = 'https://www.celebra-me.com/api/health';
	const accessLogin = 'https://celebra-me.cloudflareaccess.com/cdn-cgi/access/login';
	const redirect = (location: string, status = 302) => ({
		status,
		headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location : null) },
		json: async () => {
			throw new Error('not JSON');
		},
	});
	const productionRun = () =>
		ghRunner({
			...responses({ ...allPassed, [CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE]: 'success' }),
			'deployments/3/statuses?per_page=100': [
				{ state: 'success', environment_url: productionUrl },
			],
			[`deployments?sha=${sha}&per_page=100`]: [{ id: 3, sha, environment: 'Production' }],
		});
	// The deployment URL redirects to the Access login; the alias answers with `alias`.
	const productionFetch =
		(alias: Awaited<ReturnType<ReturnType<typeof healthy>>> | Error) => async (url: string) => {
			if (url === aliasHealthUrl) {
				if (alias instanceof Error) throw alias;
				return alias;
			}
			return redirect(accessLogin);
		};

	it('reads an authentication redirect or 401 as protected, never as the application', async () => {
		const inits: unknown[] = [];
		const login = await probeHealth(
			productionUrl,
			sha,
			async (_url, init) => {
				inits.push(init);
				return redirect(accessLogin);
			},
			undefined,
			'production',
		);
		expect(login).toMatchObject({ status: 302, commitSha: null, result: 'protected' });
		// Following the redirect would read the login page, which answers 200.
		expect(inits).toEqual([{ redirect: 'manual' }]);
		const access = await probeHealth(
			cloudflareVersionUrl,
			sha,
			async () => redirect('https://celebra-me.cloudflareaccess.com/cdn-cgi/access/login'),
			undefined,
			'preview',
		);
		expect(access.result).toBe('protected');
		const unauthorized = await probeHealth(
			productionUrl,
			sha,
			async () => ({ status: 401, json: async () => ({}) }),
			undefined,
			'production',
		);
		expect(unauthorized.result).toBe('protected');
		// Any other redirect is not the application either, and not provider authentication.
		const elsewhere = await probeHealth(
			productionUrl,
			sha,
			async () => redirect('https://example.com/'),
			undefined,
			'production',
		);
		expect(elsewhere.result).toBe('unreachable');
	});

	it('verifies Production when the public alias serves the exact SHA', async () => {
		const status = await collectReleaseStatus(sha, 'production', 'ci', {
			run: productionRun(),
			fetchImpl: productionFetch(await healthy(sha, 'production')()),
		});
		expect(status.health.map((entry) => [entry.url, entry.result])).toEqual([
			[aliasHealthUrl, 'match'],
		]);
		expect(status.state).toBe('VERIFIED');
		expect(status.blockers).toEqual([]);
	});

	it('never verifies Production unless the alias reports the exact SHA', async () => {
		const otherSha = await collectReleaseStatus(sha, 'production', 'ci', {
			run: productionRun(),
			fetchImpl: productionFetch(await healthy('b'.repeat(40), 'production')()),
		});
		expect(otherSha.state).toBe('FAILED');
		expect(otherSha.blockers).toEqual([`${aliasHealthUrl}: mismatch`]);

		const previewBuild = await collectReleaseStatus(sha, 'production', 'ci', {
			run: productionRun(),
			fetchImpl: productionFetch(await healthy(sha, 'preview')()),
		});
		expect(previewBuild.state).toBe('FAILED');

		const noIdentity = await collectReleaseStatus(sha, 'production', 'ci', {
			run: productionRun(),
			fetchImpl: productionFetch(await healthy(null, 'production')()),
		});
		expect(noIdentity.state).toBe('PENDING');
		expect(noIdentity.blockers).toEqual([`${aliasHealthUrl}: unreported`]);

		const offline = await collectReleaseStatus(sha, 'production', 'ci', {
			run: productionRun(),
			fetchImpl: productionFetch(new Error('offline')),
		});
		expect(offline.state).toBe('PENDING');
		expect(offline.blockers).toEqual([`${aliasHealthUrl}: unreachable`]);
	});

	it('keeps Preview pending: it has no public alias to stand in', async () => {
		const status = await collectReleaseStatus(sha, 'preview', 'ci', {
			run: ghRunner(
				responses({ ...allPassed, [CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE]: 'success' }),
			),
			fetchImpl: async () => redirect(accessLogin),
		});
		expect(status.health.map((entry) => entry.result)).toEqual(['protected']);
		expect(status.state).toBe('PENDING');
		expect(status.blockers).toEqual([`${previewUrl}/api/health: protected`]);
	});
});
