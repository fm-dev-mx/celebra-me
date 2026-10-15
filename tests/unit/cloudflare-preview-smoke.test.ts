import {
	parseCloudflarePreviewOrigin,
	runCloudflarePreviewSmoke,
} from '../../scripts/ops/cloudflare-preview-smoke.ts';

const sha = 'a'.repeat(40);
const stableHost = 'celebra-me-preview.celebra-me-com.workers.dev';
const versionHost = '1a2b3c4d-celebra-me-preview.celebra-me-com.workers.dev';
const accessHeaders = {
	'CF-Access-Client-Id': 'client-id.access',
	'CF-Access-Client-Secret': 'client-secret-value',
};

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
	return new Response(body, { status, headers });
}

function previewFetch(build: { commitSha: string; environment: string | null }) {
	return jest.fn(async (input: string, _init?: RequestInit) => {
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
		if (pathname === '/login' || pathname === '/xv/demo-xv-editorial') return response(200);
		if (pathname === '/api/auth/session')
			return response(401, '', { 'cache-control': 'no-store, private' });
		if (pathname === '/api/health')
			return response(
				200,
				JSON.stringify({ status: 'healthy', checks: { runtime: { status: 'ok' } }, build }),
			);
		if (pathname === '/_astro/app.abc123.js')
			return response(200, '', { 'cache-control': 'public, max-age=31536000, immutable' });
		return response(404);
	});
}

describe('Cloudflare Preview smoke', () => {
	it('accepts only the Preview Worker host or one of its version URLs', () => {
		expect(parseCloudflarePreviewOrigin(`https://${stableHost}`).hostname).toBe(stableHost);
		expect(parseCloudflarePreviewOrigin(`https://${versionHost}/`).hostname).toBe(versionHost);
		for (const rejected of [
			`http://${stableHost}`,
			`https://${stableHost}/login`,
			`https://${stableHost}?x=1`,
			'https://celebra-me.vercel.app',
			'https://celebra-me-preview.other-account.workers.dev',
			'https://evil-celebra-me-preview.celebra-me-com.workers.dev.example',
			'not a url',
		]) {
			expect(() => parseCloudflarePreviewOrigin(rejected)).toThrow();
		}
	});

	it('sends the Access service token only to the deployment and verifies the build identity', async () => {
		const fetchMock = previewFetch({ commitSha: sha, environment: 'preview' });
		const result = await runCloudflarePreviewSmoke(
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
		const otherSha = await runCloudflarePreviewSmoke(
			{ url: `https://${stableHost}`, sha },
			previewFetch({ commitSha: 'b'.repeat(40), environment: 'preview' }),
			accessHeaders,
		);
		expect(otherSha.passed).toBe(false);
		expect(otherSha.failureCodes).toEqual(['build_identity_failed']);

		const noIdentity = await runCloudflarePreviewSmoke(
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
			runCloudflarePreviewSmoke({ url: `https://${stableHost}`, sha }, fetchMock, undefined),
		).rejects.toThrow('CLOUDFLARE_ACCESS_CLIENT_ID');
		await expect(
			runCloudflarePreviewSmoke(
				{ url: `https://${stableHost}`, sha: 'abc123' },
				fetchMock,
				accessHeaders,
			),
		).rejects.toThrow('exact');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
