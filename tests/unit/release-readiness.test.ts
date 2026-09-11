import {
	PRODUCTION_DEPLOYMENT_SMOKE,
	isRemoteEvidenceUnavailable,
	loadLatestProductionDeployment,
	loadRemoteChecks,
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
	it('blocks missing Preview evidence, stale SHAs and untrusted results', () => {
		expect(() => requireReleaseChecks(sha, passing().slice(0, 2))).toThrow('preview smoke');
		const checks = passing();
		checks[0].sha = 'b'.repeat(40);
		expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
		checks[0].sha = sha;
		checks[0].trusted = false;
		expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
	});
	it('requires trusted Production smoke for the deployed SHA', () => {
		const checks = [
			{ name: PRODUCTION_DEPLOYMENT_SMOKE, sha, state: 'success', trusted: true },
		];
		expect(() => requireProductionDeploymentSmoke(sha, checks)).not.toThrow();
		checks[0].sha = 'b'.repeat(40);
		expect(() => requireProductionDeploymentSmoke(sha, checks)).toThrow();
		checks[0].sha = sha;
		checks[0].trusted = false;
		expect(() => requireProductionDeploymentSmoke(sha, checks)).toThrow();
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
