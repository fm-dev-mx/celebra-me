import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	formatEvidenceSummary,
	listSmokePageRoutes,
	resolveSmokeBaseUrl,
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

const PAGE_ROUTES = listSmokePageRoutes();
const PAGE_PATHS = new Set(PAGE_ROUTES.map((route) => `/${route.eventType}/${route.slug}`));

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
		if (pathname === '/login') {
			return response(200);
		}
		if (PAGE_PATHS.has(pathname)) {
			return response(200, '<html><head><title>Invitación</title></head></html>');
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
	it('authenticates only the approved deployment without following redirects or setting cookies', async () => {
		const fetchMock = productionFetch();
		const host = 'celebra-exact.vercel.app';
		const result = await runProductionSmoke(`https://${host}`, fetchMock, {
			approvedHost: host,
			bypassSecret: 'test-bypass-secret',
		});
		expect(result.failedProbeCount).toBe(0);
		for (const [url, init] of fetchMock.mock.calls) {
			expect(new URL(url).hostname).toBe(host);
			expect(init?.redirect).toBe('manual');
			const headers = new Headers(init?.headers);
			expect(headers.get('x-vercel-protection-bypass')).toBe('test-bypass-secret');
			expect(headers.has('x-vercel-set-bypass-cookie')).toBe(false);
			expect(headers.has('cookie')).toBe(false);
		}
		expect(result.authBoundaryVerified).toBe(true);
		expect(JSON.stringify(result)).not.toContain('test-bypass-secret');
	});
	it('rejects missing credentials or a mismatched host before contacting the deployment', async () => {
		const fetchMock = productionFetch();
		await expect(
			runProductionSmoke('https://celebra-exact.vercel.app', fetchMock),
		).rejects.toThrow('VERCEL_AUTOMATION_BYPASS_SECRET');
		await expect(
			runProductionSmoke('https://celebra-exact.vercel.app', fetchMock, {
				approvedHost: 'other.vercel.app',
				bypassSecret: 'secret',
			}),
		).rejects.toThrow('exact approved');
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('does not forward the credential to an external asset or SSO redirect', async () => {
		const fetchMock = productionFetch();
		fetchMock.mockImplementation(async () =>
			response(302, '<script src="https://external.example/_astro/app.js"></script>', {
				location: 'https://vercel.com/sso-api',
			}),
		);
		const result = await runProductionSmoke('https://celebra-exact.vercel.app', fetchMock, {
			approvedHost: 'celebra-exact.vercel.app',
			bypassSecret: 'secret',
		});
		expect(result.failureCodes).toContain('asset_failed');
		expect(
			fetchMock.mock.calls.every(
				([url]) => new URL(url).hostname === 'celebra-exact.vercel.app',
			),
		).toBe(true);
	});
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
			probeCount: 6 + PAGE_ROUTES.length,
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

	it('lists every published invitation and demo from the catalog', () => {
		const targets = PAGE_ROUTES.map(
			(route) => `${route.kind} /${route.eventType}/${route.slug}`,
		);

		expect(new Set(targets).size).toBe(targets.length);
		expect(targets).toEqual(
			expect.arrayContaining(['invitation /xv/mia-pintor', 'demo /xv/demo-xv-editorial']),
		);
		expect(PAGE_ROUTES.filter((route) => route.kind === 'invitation').length).toBeGreaterThan(
			0,
		);
		expect(PAGE_ROUTES.filter((route) => route.kind === 'demo').length).toBeGreaterThan(0);
	});

	it('opens each page and accepts 403 only for an administrator-disabled invitation', async () => {
		const pages = [
			{ kind: 'invitation', eventType: 'xv', slug: 'disabled' },
			{ kind: 'invitation', eventType: 'boda', slug: 'blank' },
			{ kind: 'demo', eventType: 'xv', slug: 'demo-forbidden' },
			{ kind: 'demo', eventType: 'xv', slug: 'demo-ok' },
		] as const;
		const baseFetch = productionFetch();
		const fetchMock = productionFetch();
		fetchMock.mockImplementation(async (input: string) => {
			const pathname = new URL(input).pathname;
			if (pathname === '/xv/disabled' || pathname === '/xv/demo-forbidden') {
				return response(403);
			}
			if (pathname === '/boda/blank') return response(200, '<html></html>');
			if (pathname === '/xv/demo-ok') return response(200, '<title>Demo</title>');
			return baseFetch(input);
		});

		const result = await runProductionSmoke('https://celebra-me.com', fetchMock, { pages });

		expect(result.failureCodes).toEqual([
			'invitation_failed:boda:blank',
			'demo_failed:xv:demo-forbidden',
		]);
		expect(result.probeResults).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					probe: 'invitation',
					target: 'xv:disabled',
					status_code: 403,
					failure_class: 'none',
				}),
				expect.objectContaining({
					probe: 'invitation',
					target: 'boda:blank',
					failure_class: 'contract_mismatch',
				}),
				expect.objectContaining({
					probe: 'demo',
					target: 'xv:demo-forbidden',
					failure_class: 'http_status',
				}),
			]),
		);
	});

	it('resolves a configurable base host limited to approved origins', () => {
		expect(resolveSmokeBaseUrl([], {})).toBe('https://www.celebra-me.com');
		expect(
			resolveSmokeBaseUrl([], { SMOKE_BASE_URL: 'https://celebra.example.workers.dev' }),
		).toBe('https://celebra.example.workers.dev');
		expect(
			resolveSmokeBaseUrl(['--base-url=https://staging.celebra-me.com/'], {
				SMOKE_BASE_URL: 'https://celebra.example.workers.dev',
			}),
		).toBe('https://staging.celebra-me.com');
		expect(() => resolveSmokeBaseUrl(['--base-url=https://example.com'], {})).toThrow(
			'unapproved host',
		);
		expect(() => resolveSmokeBaseUrl(['--base-url=http://www.celebra-me.com'], {})).toThrow(
			'HTTPS origin',
		);
		expect(() =>
			validateVercelDispatch({
				event: 'vercel.deployment.promoted',
				environment: 'production',
				projectId: 'prj_abcdef123456',
				expectedProjectId: 'prj_abcdef123456',
				deploymentId: 'dpl_abcdef123456',
				url: 'https://celebra.example.workers.dev',
				commitSha: 'a'.repeat(40),
				gitRef: 'main',
			}),
		).toThrow('unapproved host');
	});

	it('runs the same probes against a Cloudflare Worker host without a bypass secret', async () => {
		const fetchMock = productionFetch();
		const result = await runProductionSmoke('https://celebra.example.workers.dev', fetchMock);

		expect(result.failedProbeCount).toBe(0);
		expect(
			fetchMock.mock.calls.every(
				([url, init]) =>
					new URL(url).hostname === 'celebra.example.workers.dev' &&
					!new Headers(init?.headers).has('x-vercel-protection-bypass'),
			),
		).toBe(true);
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

	it('keeps the workflow event-driven, SHA-pinned, single-browser, and free of browser artifacts', () => {
		const workflow = readFileSync(
			resolve('.github', 'workflows', 'post-deploy-smoke.yml'),
			'utf8',
		);

		// Preview smoke reacts to ready; Production smoke reacts to promotion only.
		expect(workflow).toContain("'vercel.deployment.ready'");
		expect(workflow).not.toContain("'vercel.deployment.success'");
		expect(workflow).toContain("'vercel.deployment.promoted'");
		expect(workflow).toContain('ref: ${{ github.event.client_payload.git.sha }}');
		expect(workflow).toContain('cancel-in-progress: true');
		// `ready` and `promoted` dispatches for the same ref must not cancel each other.
		expect(workflow).toContain(
			'group: post-deploy-smoke-${{ github.event.action }}-${{ github.event.client_payload.environment }}-${{ github.event.client_payload.git.ref }}',
		);
		expect(workflow).toContain('environment: Production');
		expect(workflow).toContain('PROD_DB_URL: ${{ secrets.PROD_DB_URL }}');
		expect(workflow).toContain(
			'pnpm invitation:media:verify -- --target production --all --origin https://www.celebra-me.com --json',
		);
		expect(workflow.indexOf('run: pnpm ops:post-deploy -- production')).toBeLessThan(
			workflow.indexOf('pnpm invitation:media:verify -- --target production --all'),
		);
		expect(workflow).not.toContain('continue-on-error');
		expect(
			workflow.match(
				/vercel\/repository-dispatch\/actions\/status@bad8e8a0bbca4c5f5fa22483d080cb71ee5aad11/gu,
			),
		).toHaveLength(2);
		expect(workflow).not.toContain('vercel/repository-dispatch/actions/status@v1');
		expect(workflow).toContain('VERCEL_DISPATCH_EXPECTED_PROJECT_ID');
		// The only artifact is the Preview media-verification JSON (routes, asset keys, redacted
		// URLs, fixed reasons); the Production job stays artifact-free.
		const production = workflow.slice(workflow.indexOf('\n    smoke:'));
		expect(production).not.toContain('upload-artifact');
		expect(workflow.match(/uses: actions\/upload-artifact@/gu)).toHaveLength(1);
		expect(workflow).not.toMatch(/playwright-report|test-results|trace\.zip/u);
		expect(workflow).not.toMatch(/--json > \/dev\/null/u);
		expect(workflow).not.toContain('schedule:');
		expect(workflow).not.toMatch(/prod:apply|--apply|cloudinary.*secret/i);
	});

	it('keeps the Preview media-verification failure reason visible and the exit code intact', () => {
		const workflow = readFileSync(
			resolve('.github', 'workflows', 'post-deploy-smoke.yml'),
			'utf8',
		);
		const preview = workflow.slice(
			workflow.indexOf('preview-smoke:'),
			workflow.indexOf('\n    smoke:'),
		);
		expect(preview).toContain(
			'pnpm --silent invitation:media:verify -- --target preview --all --json > "$MEDIA_VERIFY_REPORT"',
		);
		expect(preview).toContain('tee -a "$GITHUB_STEP_SUMMARY"');
		expect(preview).toContain('exit "$status"');
		// Content not yet published to Preview is listed, never counted as a failure.
		expect(preview).toContain('.classification == "PENDING_PUBLISH"');
		expect(preview).toContain('.classification != "PENDING_PUBLISH"');
		const upload = preview.slice(preview.indexOf('- name: Upload media verification report'));
		expect(upload).toContain('if: always()');
		expect(upload).toContain('uses: actions/upload-artifact@v7');
		expect(upload).toContain('path: .tmp/media-verify/preview-media-verification.json');
		expect(upload).toMatch(/retention-days: [1-7]\s*$/mu);
	});

	it('runs a separate daily read-only Production image audit', () => {
		const workflow = readFileSync(
			resolve('.github', 'workflows', 'production-image-audit.yml'),
			'utf8',
		);
		expect(workflow).toContain('schedule:');
		expect(workflow).toContain('workflow_dispatch:');
		expect(workflow).toContain('environment: Production');
		expect(workflow).toContain('pnpm invitation:media:verify -- --target production --all');
		expect(workflow).not.toMatch(/prod:apply|--apply|cloudinary.*secret/i);
	});

	it('keeps generated sitemap URLs on the public origin during builds', () => {
		const config = readFileSync(resolve('astro.config.mjs'), 'utf8');
		expect(config).toContain('!isHostedBuild && !isBuildCommand');
		expect(config).toContain('publicSiteUrl');
		expect(config).toContain("'https://www.celebra-me.com'");
		expect(config).toMatch(/127\\\.0\\\.0\\\.1\|localhost/);
	});
});
