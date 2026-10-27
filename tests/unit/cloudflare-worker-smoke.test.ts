import {
	parseCloudflareWorkerOrigin,
	runCloudflareWorkerSmoke,
} from '../../scripts/ops/cloudflare-worker-smoke.ts';
import { listSmokePageRoutes } from '../../scripts/ops/post-deploy-smoke.ts';
import { visualPageRoute } from '../../scripts/screenshot/visual-coverage-contract.ts';

const sha = 'a'.repeat(40);
const PAGE_PATHS = new Set(listSmokePageRoutes().map(visualPageRoute));
const stableHost = 'celebra-me-preview.celebra-me-com.workers.dev';
const versionHost = '1a2b3c4d-celebra-me-preview.celebra-me-com.workers.dev';
const accessHeaders = {
	'CF-Access-Client-Id': 'client-id.access',
	'CF-Access-Client-Secret': 'client-secret-value',
};

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
	return new Response(body, { status, headers });
}

function previewFetch(
	build: { commitSha: string; environment: string | null },
	options: { openWithoutToken?: boolean; contactLocation?: string } = {},
) {
	return jest.fn(async (input: string, init?: RequestInit) => {
		const pathname = new URL(input).pathname;
		const authorized = new Headers(init?.headers).has('cf-access-client-id');
		if (!authorized && !options.openWithoutToken)
			return response(302, '', { location: 'https://team.cloudflareaccess.com/login' });
		if (pathname === '/') {
			return response(200, '<script src="/_astro/app.abc123.js"></script>', {
				'x-content-type-options': 'nosniff',
				'x-frame-options': 'DENY',
				'referrer-policy': 'strict-origin-when-cross-origin',
				'permissions-policy': 'camera=(), microphone=(), geolocation=()',
				'strict-transport-security': 'max-age=31536000; includeSubDomains',
			});
		}
		if (pathname === '/login') return response(200);
		if (PAGE_PATHS.has(pathname)) return response(200, '<title>Invitación</title>');
		if (pathname === '/api/auth/session')
			return response(401, '', { 'cache-control': 'no-store, private' });
		if (pathname === '/api/health')
			return response(
				200,
				JSON.stringify({ status: 'healthy', checks: { runtime: { status: 'ok' } }, build }),
			);
		if (pathname === '/api/whatsapp')
			return response(302, '', {
				location: options.contactLocation ?? 'https://wa.me/5216681234567?text=Hola',
			});
		if (pathname === '/_astro/app.abc123.js')
			return response(200, '', { 'cache-control': 'public, max-age=31536000, immutable' });
		return response(404);
	});
}

describe('Cloudflare Preview smoke', () => {
	it.each([
		['preview', false],
		['preview', true],
		['production', false],
		['production', true],
	] as const)(
		'scopes the archived-copy exclusion to Preview (%s, unrelated 404: %s)',
		async (environment, unrelatedMissing) => {
			jest.useFakeTimers({ now: new Date('2026-10-27T12:00:00Z') });
			try {
				const baseFetch = previewFetch({ commitSha: sha, environment });
				const fetchMock = jest.fn(async (input: string, init?: RequestInit) => {
					const path = new URL(input).pathname;
					if (
						path === '/boda/daniela-y-martin' ||
						(unrelatedMissing && path === '/xv/mia-pintor')
					) {
						return response(404);
					}
					return baseFetch(input, init);
				});
				const host =
					environment === 'preview'
						? versionHost
						: '9f8e7d6c-celebra-me.celebra-me-com.workers.dev';
				const result = await runCloudflareWorkerSmoke(
					{ url: `https://${host}`, sha, environment },
					fetchMock,
					accessHeaders,
				);
				const expectedFailures = [
					...(environment === 'production'
						? ['invitation_failed:boda:daniela-y-martin']
						: []),
					...(unrelatedMissing ? ['invitation_failed:xv:mia-pintor'] : []),
				];
				expect(result.failureCodes).toEqual(expectedFailures);
				const requestedPaths = fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
				expect(requestedPaths.includes('/boda/daniela-y-martin')).toBe(
					environment === 'production',
				);
				expect(result.passed).toBe(expectedFailures.length === 0);
			} finally {
				jest.useRealTimers();
			}
		},
	);

	it('accepts only the Preview Worker host or one of its version URLs', () => {
		expect(parseCloudflareWorkerOrigin(`https://${stableHost}`).hostname).toBe(stableHost);
		expect(parseCloudflareWorkerOrigin(`https://${versionHost}/`).hostname).toBe(versionHost);
		for (const rejected of [
			`http://${stableHost}`,
			`https://${stableHost}/login`,
			`https://${stableHost}?x=1`,
			'https://celebra-me.example.com',
			'https://celebra-me-preview.other-account.workers.dev',
			'https://evil-celebra-me-preview.celebra-me-com.workers.dev.example',
			'not a url',
		]) {
			expect(() => parseCloudflareWorkerOrigin(rejected)).toThrow();
		}
	});

	it('sends the Access service token only to the deployment and verifies the build identity', async () => {
		const fetchMock = previewFetch({ commitSha: sha, environment: 'preview' });
		const result = await runCloudflareWorkerSmoke(
			{ url: `https://${versionHost}`, sha: sha.toUpperCase() },
			fetchMock,
			accessHeaders,
		);
		expect(result.passed).toBe(true);
		expect(result.failureCodes).toEqual([]);
		expect(result.identity).toEqual({ commitSha: sha, environment: 'preview', verified: true });
		for (const [url, init] of fetchMock.mock.calls) {
			expect(new URL(url).hostname).toBe(versionHost);
			expect(init?.redirect).toBe('manual');
			const headers = new Headers(init?.headers);
			expect(headers.get('cf-access-client-id')).toBe('client-id.access');
			expect(headers.get('cf-access-client-secret')).toBe('client-secret-value');
			expect(headers.has('cookie')).toBe(false);
		}
		expect(JSON.stringify(result)).not.toContain('client-secret-value');
	});

	it('fails on another SHA or a missing Preview deploy identity', async () => {
		const otherSha = await runCloudflareWorkerSmoke(
			{ url: `https://${stableHost}`, sha },
			previewFetch({ commitSha: 'b'.repeat(40), environment: 'preview' }),
			accessHeaders,
		);
		expect(otherSha.passed).toBe(false);
		expect(otherSha.failureCodes).toEqual(['build_identity_failed']);

		const noIdentity = await runCloudflareWorkerSmoke(
			{ url: `https://${stableHost}`, sha },
			previewFetch({ commitSha: sha, environment: null }),
			accessHeaders,
		);
		expect(noIdentity.identity.verified).toBe(false);
		expect(noIdentity.passed).toBe(false);
	});

	it('refuses to run without the service token or with an inexact SHA', async () => {
		const fetchMock = previewFetch({ commitSha: sha, environment: 'preview' });
		await expect(
			runCloudflareWorkerSmoke({ url: `https://${stableHost}`, sha }, fetchMock, undefined),
		).rejects.toThrow('CLOUDFLARE_ACCESS_CLIENT_ID');
		await expect(
			runCloudflareWorkerSmoke(
				{ url: `https://${stableHost}`, sha: 'abc123' },
				fetchMock,
				accessHeaders,
			),
		).rejects.toThrow('exact');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('Cloudflare Production smoke', () => {
	const productionVersionHost = '9f8e7d6c-celebra-me.celebra-me-com.workers.dev';

	it('accepts only Production version URLs', () => {
		expect(
			parseCloudflareWorkerOrigin(`https://${productionVersionHost}`, 'production').hostname,
		).toBe(productionVersionHost);
		for (const rejected of [
			'https://celebra-me.celebra-me-com.workers.dev',
			`https://${stableHost}`,
			`https://${versionHost}`,
			'https://www.celebra-me.com',
			'https://9f8e7d6c-celebra-me.other-account.workers.dev',
		]) {
			expect(() => parseCloudflareWorkerOrigin(rejected, 'production')).toThrow();
		}
		expect(() => parseCloudflareWorkerOrigin(`https://${productionVersionHost}`)).toThrow();
	});

	it('passes a closed version URL that serves the SHA as production', async () => {
		const result = await runCloudflareWorkerSmoke(
			{ url: `https://${productionVersionHost}`, sha, environment: 'production' },
			previewFetch({ commitSha: sha, environment: 'production' }),
			accessHeaders,
		);
		expect(result.failureCodes).toEqual([]);
		expect(result.accessEnforced).toBe(true);
		expect(result.contactWhatsAppConfigured).toBe(true);
		expect(result.passed).toBe(true);
	});

	it('fails a Production version whose WhatsApp redirect carries no real number', async () => {
		for (const contactLocation of [
			'https://wa.me/521000000000',
			'https://example.com/5216681234567',
		]) {
			const result = await runCloudflareWorkerSmoke(
				{ url: `https://${productionVersionHost}`, sha, environment: 'production' },
				previewFetch({ commitSha: sha, environment: 'production' }, { contactLocation }),
				accessHeaders,
			);
			expect(result.contactWhatsAppConfigured).toBe(false);
			expect(result.failureCodes).toEqual(['contact_whatsapp_missing']);
		}
	});

	it('fails a version URL that answers without the Access token', async () => {
		const result = await runCloudflareWorkerSmoke(
			{ url: `https://${productionVersionHost}`, sha, environment: 'production' },
			previewFetch({ commitSha: sha, environment: 'production' }, { openWithoutToken: true }),
			accessHeaders,
		);
		expect(result.accessEnforced).toBe(false);
		expect(result.failureCodes).toEqual(['access_not_enforced']);
	});

	it('fails a Production version that reports the Preview identity', async () => {
		const result = await runCloudflareWorkerSmoke(
			{ url: `https://${productionVersionHost}`, sha, environment: 'production' },
			previewFetch({ commitSha: sha, environment: 'preview' }),
			accessHeaders,
		);
		expect(result.failureCodes).toEqual(['build_identity_failed']);
	});
});
