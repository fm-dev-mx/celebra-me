import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	formatEvidenceSummary,
	runProductionSmoke,
	validateVercelDispatch,
	type PostDeployEvidence,
} from '../../scripts/ops/post-deploy-smoke';

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
	return {
		status,
		headers: new Headers(headers),
		text: async () => body,
		json: async () => JSON.parse(body) as unknown,
	} as unknown as Response;
}

function productionFetch(): jest.MockedFunction<
	(input: string, init?: RequestInit) => Promise<Response>
> {
	return jest.fn(async (input: string) => {
		const pathname = new URL(input).pathname;
		if (pathname === '/') {
			return response(200, '<script src="/_astro/app.abc123.js"></script>', {
				'x-content-type-options': 'nosniff',
				'x-frame-options': 'DENY',
				'referrer-policy': 'strict-origin-when-cross-origin',
				'permissions-policy': 'camera=(), microphone=(), geolocation=()',
				'strict-transport-security': 'max-age=31536000; includeSubDomains',
			});
		}
		if (pathname === '/login' || pathname === '/xv/demo-xv-editorial') {
			return response(200);
		}
		if (pathname === '/api/auth/session') {
			return response(401, '', { 'cache-control': 'no-store, private' });
		}
		if (pathname === '/api/health') {
			return response(
				200,
				JSON.stringify({ status: 'healthy', checks: { runtime: { status: 'ok' } } }),
			);
		}
		if (pathname === '/_astro/app.abc123.js') {
			return response(200, '', { 'cache-control': 'public, max-age=31536000, immutable' });
		}
		return response(404);
	});
}

describe('post-deploy smoke', () => {
	it('executes the workflow argument form without contacting a provider', () => {
		const env = {
			...process.env,
			GITHUB_ENV: '',
			VERCEL_DISPATCH_EVENT: 'vercel.deployment.ready',
			VERCEL_DISPATCH_ENVIRONMENT: 'preview',
			VERCEL_DISPATCH_PROJECT_ID: 'prj_abcdef123456',
			VERCEL_DISPATCH_EXPECTED_PROJECT_ID: 'prj_abcdef123456',
			VERCEL_DISPATCH_DEPLOYMENT_ID: 'dpl_abcdef123456',
			VERCEL_DISPATCH_URL: 'https://celebra-abc123-francisco-mendoza-s-projects.vercel.app',
			VERCEL_DISPATCH_COMMIT_SHA: 'a'.repeat(40),
			VERCEL_DISPATCH_GIT_REF: 'develop',
		};
		const run = (args: string[], overrides = {}) =>
			spawnSync(
				process.execPath,
				['--import', 'tsx', 'scripts/ops/post-deploy-smoke.ts', ...args],
				{ encoding: 'utf8', env: { ...env, ...overrides }, timeout: 15000 },
			);
		const valid = run(['--', 'validate']);
		expect(valid.stderr).toBe('');
		expect(valid.status).toBe(0);
		expect(valid.stdout).toContain('a'.repeat(40));
		expect(run(['--', 'invalid']).status).not.toBe(0);
		expect(run(['--', 'validate', 'extra']).status).not.toBe(0);
		expect(
			run(['--', 'validate'], { VERCEL_DISPATCH_EXPECTED_PROJECT_ID: 'prj_other' }).status,
		).not.toBe(0);
	}, 30000);
	it('accepts only the exact Preview ready or Production promoted transition', () => {
		const base = {
			projectId: 'prj_abcdef123456',
			expectedProjectId: 'prj_abcdef123456',
			deploymentId: 'dpl_abcdef123456',
			url: 'https://celebra-abc123-francisco-mendoza-s-projects.vercel.app',
			commitSha: 'a'.repeat(40),
			gitRef: 'feature/observability',
		};

		expect(
			validateVercelDispatch({
				...base,
				event: 'vercel.deployment.ready',
				environment: 'preview',
			}).environment,
		).toBe('preview');
		expect(() =>
			validateVercelDispatch({
				...base,
				event: 'vercel.deployment.success',
				environment: 'preview',
			}),
		).toThrow('approved environment transition');
		expect(() =>
			validateVercelDispatch({
				...base,
				event: 'vercel.deployment.ready',
				environment: 'production',
			}),
		).toThrow('approved environment transition');
		expect(() =>
			validateVercelDispatch({
				...base,
				projectId: 'prj_other',
				event: 'vercel.deployment.ready',
				environment: 'preview',
			}),
		).toThrow('different or invalid Vercel project');
	});

	it('verifies public Production runtime, auth boundary, assets, and security headers', async () => {
		const result = await runProductionSmoke('https://celebra-me.com', productionFetch());

		expect(result).toEqual({
			probeCount: 7,
			failedProbeCount: 0,
			networkRetryCount: 0,
			runtimeHealthVerified: true,
			assetVerified: true,
			authBoundaryVerified: true,
			headerPolicyVerified: true,
			failureCodes: [],
			probeResults: expect.arrayContaining([
				expect.objectContaining({
					probe: 'homepage',
					target: 'root',
					status_code: 200,
					failure_class: 'none',
					retry_count: 0,
				}),
			]),
		});
	});

	it('performs only one retry for a transient network response', async () => {
		const fetchMock = productionFetch();
		fetchMock.mockResolvedValueOnce(response(503));

		const result = await runProductionSmoke('https://celebra-me.com', fetchMock);

		expect(result.networkRetryCount).toBe(1);
		expect(result.failedProbeCount).toBe(0);
		expect(result.probeResults[0]).toMatchObject({ retry_count: 1, failure_class: 'none' });
	});

	it('records safe HTTP, JSON, and network diagnostics without request data', async () => {
		const http = await runProductionSmoke(
			'https://celebra-me.com',
			jest.fn(async () => response(403)),
		);
		expect(http.probeResults).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					probe: 'homepage',
					status_code: 403,
					failure_class: 'http_status',
				}),
			]),
		);

		const baseFetch = productionFetch();
		const invalidJson = productionFetch();
		invalidJson.mockImplementation(async (input: string) =>
			new URL(input).pathname === '/api/health'
				? response(200, 'not-json')
				: baseFetch(input),
		);
		const json = await runProductionSmoke('https://celebra-me.com', invalidJson);
		expect(json.probeResults).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					probe: 'runtime_health',
					status_code: 200,
					failure_class: 'json_invalid',
				}),
			]),
		);

		const network = await runProductionSmoke(
			'https://celebra-me.com',
			jest.fn(async () => Promise.reject(new Error('secret-url?token=do-not-log'))),
		);
		expect(network.probeResults).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					status_code: null,
					failure_class: 'network_error',
					retry_count: 1,
				}),
			]),
		);
		expect(JSON.stringify(network.probeResults)).not.toContain('secret-url');
	});

	it('renders probe diagnostics without URLs, query strings, or response data', () => {
		const evidence: PostDeployEvidence = {
			schemaVersion: 1,
			check: 'post_deploy_smoke',
			environment: 'production',
			runId: 'run_abcdef123',
			startedAt: '2026-09-10T22:00:00.000Z',
			completedAt: '2026-09-10T22:00:01.000Z',
			observedAt: '2026-09-10T22:00:01.000Z',
			status: 'FAILED',
			reasonCode: 'post_deploy_smoke_failed',
			source: 'github_actions',
			ownerAction: 'Revise el Job Summary.',
			commitSha: 'a'.repeat(40),
			deploymentId: 'dpl_abcdef123',
			payload: {
				probe_count: 7,
				failed_probe_count: 1,
				network_retry_count: 0,
				runtime_health_verified: false,
				asset_verified: false,
				auth_boundary_verified: false,
				header_policy_verified: false,
				probe_results: [
					{
						probe: 'homepage',
						target: 'root',
						status_code: 403,
						failure_class: 'http_status',
						retry_count: 0,
						duration_ms: 8,
					},
				],
			},
		};

		const summary = formatEvidenceSummary(evidence);
		expect(summary).toContain('| homepage | root | 403 | http_status | 0 | 8 |');
		expect(summary).not.toMatch(/https?:\/\/|\?|cookie|body|token|secret/i);
	});

	it('keeps the workflow event-driven, SHA-pinned, single-browser, and artifact-free', () => {
		const workflow = readFileSync(
			resolve('.github', 'workflows', 'post-deploy-smoke.yml'),
			'utf8',
		);

		expect(workflow).toContain("'vercel.deployment.ready'");
		expect(workflow).not.toContain("'vercel.deployment.success'");
		expect(workflow).toContain("'vercel.deployment.promoted'");
		expect(workflow).toContain('ref: ${{ github.event.client_payload.git.sha }}');
		expect(workflow).toContain('cancel-in-progress: true');
		expect(workflow).toContain('pnpm test:e2e:preview:public');
		expect(workflow).toContain('playwright install --with-deps chromium');
		expect(workflow).toContain('VERCEL_DISPATCH_EXPECTED_PROJECT_ID');
		expect(workflow).not.toContain('upload-artifact');
		expect(workflow).not.toContain('schedule:');
	});
});
