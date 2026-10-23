import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	formatEvidenceSummary,
	listSmokePageRoutes,
	resolveSmokeBaseUrl,
	runProductionSmoke,
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
	it('sends no credentials and never follows redirects', async () => {
		const fetchMock = productionFetch();
		const host = 'celebra.example.workers.dev';
		const result = await runProductionSmoke(`https://${host}`, fetchMock);
		expect(result.failedProbeCount).toBe(0);
		for (const [url, init] of fetchMock.mock.calls) {
			expect(new URL(url).hostname).toBe(host);
			expect(init?.redirect).toBe('manual');
			const headers = new Headers(init?.headers);
			expect(headers.has('cookie')).toBe(false);
			expect(headers.has('authorization')).toBe(false);
		}
		expect(result.authBoundaryVerified).toBe(true);
	});
	it('does not follow a redirect or an external asset to another origin', async () => {
		const fetchMock = productionFetch();
		fetchMock.mockImplementation(async () =>
			response(302, '<script src="https://external.example/_astro/app.js"></script>', {
				location: 'https://external.example/login',
			}),
		);
		const result = await runProductionSmoke('https://celebra.example.workers.dev', fetchMock);
		expect(result.failureCodes).toContain('asset_failed');
		expect(
			fetchMock.mock.calls.every(
				([url]) => new URL(url).hostname === 'celebra.example.workers.dev',
			),
		).toBe(true);
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
	});

	it('runs the same probes against a Cloudflare Worker host without credentials', async () => {
		const fetchMock = productionFetch();
		const result = await runProductionSmoke('https://celebra.example.workers.dev', fetchMock);

		expect(result.failedProbeCount).toBe(0);
		expect(
			fetchMock.mock.calls.every(
				([url, init]) =>
					new URL(url).hostname === 'celebra.example.workers.dev' &&
					!new Headers(init?.headers).has('authorization'),
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

	it('runs a weekly read-only invitation delivery budget that alerts by issue', () => {
		const workflow = readFileSync(
			resolve('.github', 'workflows', 'invitation-delivery-budget.yml'),
			'utf8',
		);
		expect(workflow).toContain('schedule:');
		expect(workflow).toContain('workflow_dispatch:');
		expect(workflow).not.toMatch(/pull_request|push:/);
		expect(workflow).toContain('pnpm invitation:delivery:baseline');
		expect(workflow).toContain('--origin https://www.celebra-me.com');
		expect(workflow).toContain('--assert-budget');
		expect(workflow).toContain('gh issue create');
		expect(workflow).not.toMatch(/\$\{\{\s*secrets\.|prod:apply|--apply/);
	});

	it('runs a read-only Production smoke every 15 minutes and alerts after two failures', () => {
		const workflow = readFileSync(
			resolve('.github', 'workflows', 'production-uptime.yml'),
			'utf8',
		);
		expect(workflow).toContain("- cron: '*/15 * * * *'");
		expect(workflow).toContain(
			'pnpm ops:post-deploy -- check --base-url=https://www.celebra-me.com',
		);
		expect(workflow).toMatch(/permissions:\s+contents: read\s+actions: read\s+issues: write/u);
		expect(workflow).toContain('select(.databaseId != $GITHUB_RUN_ID)');
		expect(workflow).toContain('if [ "$previous" != "failure" ]; then');
		expect(workflow).toContain('gh issue create');
		expect(workflow).not.toMatch(
			/secrets\.|environment:|prod:apply|--apply|vercel |wrangler/iu,
		);
	});

	it('keeps generated sitemap URLs on the public origin during builds', () => {
		const config = readFileSync(resolve('astro.config.mjs'), 'utf8');
		expect(config).toContain('!isHostedBuild && !isBuildCommand');
		expect(config).toContain('publicSiteUrl');
		expect(config).toContain("'https://www.celebra-me.com'");
		expect(config).toMatch(/127\\\.0\\\.0\\\.1\|localhost/);
	});
});
