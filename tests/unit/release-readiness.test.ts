import {
	CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE,
	STATIC_CAPABILITY_CHECK,
	isRemoteEvidenceUnavailable,
	loadLatestProductionDeployment,
	loadRemoteChecks,
	requireStaticCapabilityCheck,
	requireProductionDeploymentSmoke,
	requireReleaseChecks,
	REQUIRED_RELEASE_CHECKS,
} from '../../scripts/ops/release-readiness.ts';

const sha = 'a'.repeat(40);
const passing = () =>
	REQUIRED_RELEASE_CHECKS.map((name) => ({ name, sha, state: 'success', trusted: true }));

function ghRunner(responses: Record<string, unknown>): (args: string[]) => string {
	return (args) => {
		if (args[0] === 'repo') return 'celebra-me/test\n';
		const key = args[1]?.replace('repos/celebra-me/test/', '') ?? '';
		if (!(key in responses)) throw new Error(`Unexpected GitHub API request: ${key}`);
		return JSON.stringify(responses[key]);
	};
}
describe('release check evidence', () => {
	it('requires every trusted check on the exact SHA', () =>
		expect(() => requireReleaseChecks(sha, passing())).not.toThrow());
	it.each(['failure', 'cancelled', 'pending', 'in_progress', 'skipped', 'neutral'])(
		'blocks %s',
		(state) => {
			const checks = passing();
			checks[1].state = state;
			expect(() => requireReleaseChecks(sha, checks)).toThrow('Application Suite');
		},
	);
	it('tells a still-running CI apart from a failed one', () => {
		const running = passing();
		running[1].state = 'in_progress';
		expect(() => requireReleaseChecks(sha, running)).toThrow(
			/Release checks pending for aaaaaaaaa: Application Suite \(in_progress\)/,
		);
		expect(() =>
			requireReleaseChecks(
				sha,
				passing().filter((check) => check.name !== 'Application Suite'),
			),
		).toThrow(/pending .*Application Suite \(not reported\)/);

		const failed = passing();
		failed[1].state = 'failure';
		failed[0].state = 'in_progress';
		// Any failure makes the whole result blocked, never "wait and retry".
		expect(() => requireReleaseChecks(sha, failed)).toThrow(
			/^Release checks blocked: Repository Policy \(in_progress\), Application Suite \(failure\)$/,
		);
		const untrusted = passing();
		untrusted[1].trusted = false;
		expect(() => requireReleaseChecks(sha, untrusted)).toThrow(
			/blocked: Application Suite \(success, untrusted\)/,
		);
	});
	it('blocks missing application evidence, stale SHAs and untrusted results', () => {
		expect(() =>
			requireReleaseChecks(
				sha,
				passing().filter((check) => check.name !== 'Application Suite'),
			),
		).toThrow('Application Suite');
		const checks = passing();
		checks[0].sha = 'b'.repeat(40);
		expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
		checks[0].sha = sha;
		checks[0].trusted = false;
		expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
	});
	it('requires trusted Production smoke for the deployed SHA', () => {
		const checks = [
			{ name: CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE, sha, state: 'success', trusted: true },
		];
		expect(() => requireProductionDeploymentSmoke(sha, checks)).not.toThrow();
		checks[0].sha = 'b'.repeat(40);
		expect(() => requireProductionDeploymentSmoke(sha, checks)).toThrow();
		checks[0].sha = sha;
		checks[0].trusted = false;
		expect(() => requireProductionDeploymentSmoke(sha, checks)).toThrow();
	});

	it('names the Cloudflare Production smoke when it is missing', () => {
		const checks = [
			{ name: CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE, sha, state: 'success', trusted: false },
		];
		expect(() => requireProductionDeploymentSmoke(sha, checks)).toThrow('Cloudflare');
	});

	it('requires trusted static capability evidence for the deployed SHA', () => {
		const checks = [{ name: STATIC_CAPABILITY_CHECK, sha, state: 'success', trusted: true }];
		expect(() => requireStaticCapabilityCheck(sha, checks)).not.toThrow();
		checks[0].sha = 'b'.repeat(40);
		expect(() => requireStaticCapabilityCheck(sha, checks)).toThrow(
			'Static capability evidence',
		);
		checks[0].sha = sha;
		checks[0].trusted = false;
		expect(() => requireStaticCapabilityCheck(sha, checks)).toThrow(
			'Static capability evidence',
		);
	});

	it('loads exact remote checks and treats incomplete pages as unavailable', () => {
		const runner = ghRunner({
			[`commits/${sha}/check-runs?filter=latest&per_page=100`]: {
				total_count: 1,
				check_runs: [
					{
						id: 1,
						name: 'Repository Policy',
						head_sha: sha,
						status: 'completed',
						conclusion: 'success',
						app: { id: 15368 },
					},
				],
			},
			[`commits/${sha}/statuses?per_page=100`]: [],
		});
		expect(loadRemoteChecks(sha, runner)).toContainEqual({
			name: 'Repository Policy',
			sha,
			state: 'success',
			trusted: true,
		});
		const incomplete = ghRunner({
			[`commits/${sha}/check-runs?filter=latest&per_page=100`]: {
				total_count: 101,
				check_runs: [],
			},
			[`commits/${sha}/statuses?per_page=100`]: [],
		});
		try {
			loadRemoteChecks(sha, incomplete);
			throw new Error('Expected incomplete evidence to fail.');
		} catch (error) {
			expect(isRemoteEvidenceUnavailable(error)).toBe(true);
		}
	});

	describe('paginated check runs', () => {
		const checkRunsPath = `commits/${sha}/check-runs?filter=latest&per_page=100`;
		const statusesPath = `commits/${sha}/statuses?per_page=100`;
		const smokeRun = (id: number) => ({
			id,
			name: 'Cloudflare post-deploy smoke',
			head_sha: sha,
			status: 'completed',
			conclusion: 'success',
			app: { id: 15368 },
		});
		const policyRun = (id: number, conclusion: string, headSha = sha) => ({
			id,
			name: 'Repository Policy',
			head_sha: headSha,
			status: 'completed',
			conclusion,
			app: { id: 15368 },
		});
		const policyOf = (checks: ReturnType<typeof loadRemoteChecks>) =>
			checks.find((check) => check.name === 'Repository Policy');

		it('reads every page when a commit has more than 100 check runs', () => {
			const firstPage = Array.from({ length: 100 }, (_, i) => smokeRun(1000 - i));
			const runner = ghRunner({
				[checkRunsPath]: { total_count: 109, check_runs: firstPage },
				[`${checkRunsPath}&page=2`]: {
					total_count: 109,
					check_runs: [
						...Array.from({ length: 8 }, (_, i) => smokeRun(800 - i)),
						policyRun(5, 'success'),
					],
				},
				[statusesPath]: [],
			});
			expect(policyOf(loadRemoteChecks(sha, runner))).toEqual({
				name: 'Repository Policy',
				sha,
				state: 'success',
				trusted: true,
			});
		});

		it('lets the latest run per check name decide across pages', () => {
			const runner = ghRunner({
				[checkRunsPath]: {
					total_count: 101,
					check_runs: [
						policyRun(900, 'failure'),
						...Array.from({ length: 99 }, (_, i) => smokeRun(800 - i)),
					],
				},
				[`${checkRunsPath}&page=2`]: {
					total_count: 101,
					check_runs: [policyRun(10, 'success')],
				},
				[statusesPath]: [],
			});
			expect(policyOf(loadRemoteChecks(sha, runner))?.state).toBe('failure');
			const newestOnLaterPage = ghRunner({
				[checkRunsPath]: {
					total_count: 101,
					check_runs: [
						policyRun(10, 'success'),
						...Array.from({ length: 99 }, (_, i) => smokeRun(800 - i)),
					],
				},
				[`${checkRunsPath}&page=2`]: {
					total_count: 101,
					check_runs: [policyRun(900, 'in_progress')],
				},
				[statusesPath]: [],
			});
			const pending = loadRemoteChecks(sha, newestOnLaterPage);
			expect(policyOf(pending)?.state).toBe('in_progress');
			expect(() => requireReleaseChecks(sha, pending)).toThrow('Repository Policy');
		});

		it('keeps a different-SHA latest run as evidence for another SHA', () => {
			const other = 'b'.repeat(40);
			const runner = ghRunner({
				[checkRunsPath]: {
					total_count: 101,
					check_runs: Array.from({ length: 100 }, (_, i) => smokeRun(800 - i)),
				},
				[`${checkRunsPath}&page=2`]: {
					total_count: 101,
					check_runs: [policyRun(900, 'success', other)],
				},
				[statusesPath]: [],
			});
			const checks = loadRemoteChecks(sha, runner);
			expect(policyOf(checks)?.sha).toBe(other);
			expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
		});

		it('treats a short page before total_count as unavailable', () => {
			const runner = ghRunner({
				[checkRunsPath]: {
					total_count: 150,
					check_runs: Array.from({ length: 100 }, (_, i) => smokeRun(800 - i)),
				},
				[`${checkRunsPath}&page=2`]: {
					total_count: 150,
					check_runs: [policyRun(5, 'success')],
				},
				[statusesPath]: [],
			});
			expect(() => loadRemoteChecks(sha, runner)).toThrow('Check result page is incomplete.');
		});

		it('reads commit statuses past the first page', () => {
			const smoke = CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE;
			const runner = ghRunner({
				[checkRunsPath]: { total_count: 0, check_runs: [] },
				[statusesPath]: Array.from({ length: 100 }, () => ({
					context: 'Cloudflare - other status',
					state: 'success',
				})),
				[`${statusesPath}&page=2`]: [
					{ context: smoke, state: 'success', creator: { login: 'github-actions[bot]' } },
				],
			});
			expect(loadRemoteChecks(sha, runner)).toContainEqual({
				name: smoke,
				sha,
				state: 'success',
				trusted: true,
			});
		});
	});

	it('resolves the repository identity once per runner', () => {
		let repoViews = 0;
		const base = ghRunner({
			[`commits/${sha}/check-runs?filter=latest&per_page=100`]: {
				total_count: 0,
				check_runs: [],
			},
			[`commits/${sha}/statuses?per_page=100`]: [],
		});
		const runner = (args: string[]) => {
			if (args[0] === 'repo') repoViews += 1;
			return base(args);
		};
		loadRemoteChecks(sha, runner);
		loadRemoteChecks(sha, runner);
		expect(repoViews).toBe(1);
	});

	it('requires the latest successful Production deployment', () => {
		const runner = ghRunner({
			'deployments?environment=production&per_page=100': [
				{ id: 42, environment: 'production', sha },
			],
			'deployments/42/statuses?per_page=100': [{ state: 'success' }],
		});
		expect(loadLatestProductionDeployment(runner)).toEqual({ id: 42, sha });
		const hundredDeployments = ghRunner({
			'deployments?environment=production&per_page=100': Array.from(
				{ length: 100 },
				(_, i) => ({ id: 100 - i, environment: 'production', sha }),
			),
			'deployments/100/statuses?per_page=100': [{ state: 'success' }],
		});
		expect(loadLatestProductionDeployment(hundredDeployments)).toEqual({ id: 100, sha });
		const failed = ghRunner({
			'deployments?environment=production&per_page=100': [
				{ id: 42, environment: 'production', sha },
			],
			'deployments/42/statuses?per_page=100': [{ state: 'failure' }],
		});
		expect(() => loadLatestProductionDeployment(failed)).toThrow('did not succeed');
	});

	it.each(['production', 'Production', ' Production '])(
		'accepts a normalized Production deployment environment: %s',
		(environment) => {
			const runner = ghRunner({
				'deployments?environment=production&per_page=100': [{ id: 42, environment, sha }],
				'deployments/42/statuses?per_page=100': [{ state: 'success' }],
			});
			expect(loadLatestProductionDeployment(runner)).toEqual({ id: 42, sha });
		},
	);

	it('rejects missing, blank, and non-string deployment environments', () => {
		for (const environment of [undefined, '', ' preview ', 42]) {
			const runner = ghRunner({
				'deployments?environment=production&per_page=100': [{ id: 42, environment, sha }],
			});
			expect(() => loadLatestProductionDeployment(runner)).toThrow('history is unavailable');
		}
	});

	it('handles check runs without an app object safely as untrusted', () => {
		const runner = ghRunner({
			[`commits/${sha}/check-runs?filter=latest&per_page=100`]: {
				total_count: 1,
				check_runs: [
					{
						id: 1,
						name: 'Repository Policy',
						head_sha: sha,
						status: 'completed',
						conclusion: 'success',
					},
				],
			},
			[`commits/${sha}/statuses?per_page=100`]: [],
		});
		expect(loadRemoteChecks(sha, runner)).toContainEqual({
			name: 'Repository Policy',
			sha,
			state: 'success',
			trusted: false,
		});
	});
});
