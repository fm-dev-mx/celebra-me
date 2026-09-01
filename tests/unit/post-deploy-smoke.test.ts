import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runProductionSmoke, validateVercelDispatch } from '../../scripts/ops/post-deploy-smoke';

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
		});
	});

	it('performs only one retry for a transient network response', async () => {
		const fetchMock = productionFetch();
		fetchMock.mockResolvedValueOnce(response(503));

		const result = await runProductionSmoke('https://celebra-me.com', fetchMock);

		expect(result.networkRetryCount).toBe(1);
		expect(result.failedProbeCount).toBe(0);
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
