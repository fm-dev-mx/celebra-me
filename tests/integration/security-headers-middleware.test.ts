import type { APIContext } from 'astro';
import { onRequest as middleware } from '../../src/middleware';
import {
	INVITATION_PREVIEW_SECURITY_HEADERS,
	PERMANENT_REDIRECTS,
	SECURITY_HEADERS,
	resolvePermanentRedirectPath,
	resolveSecurityHeaders,
} from '../../src/lib/server/security-headers';

/**
 * `src/middleware.ts` is the only source of the security headers and permanent redirects.
 * The literal values below are the served contract, so a change to any of them is a
 * deliberate edit to both the module and this suite.
 */

const EXPECTED_GLOBAL_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'x-xss-protection': '1; mode=block',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()',
	'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

const EXPECTED_PREVIEW_HEADERS: Record<string, string> = {
	...EXPECTED_GLOBAL_HEADERS,
	'x-frame-options': 'SAMEORIGIN',
	'content-security-policy': "frame-ancestors 'self'",
};

const EXPECTED_REDIRECTS = [
	{
		source: '/boda/demo-boda-jewelry-box-wedding',
		destination: '/brisa',
	},
	{
		source: '/boda/demo-boda-jewelry-box-wedding/',
		destination: '/brisa',
	},
	{
		source: '/bautizo/demo-bautismo-angelic-presence',
		destination: '/angelical',
	},
	{
		source: '/primera-comunion/demo-primera-comunion-illustrated',
		destination: '/comunion-angelical',
	},
];

const PREVIEW_PATH = /^\/dashboard\/invitaciones\/[^/]+\/preview$/;
// The landing showroom frames the demo short routes.
const FRAMEABLE_DEMO_PATHS = new Set(['/brisa', '/jardin-de-luz']);

const SAMPLE_PATHS = [
	'/',
	'/login',
	'/boda/daniela-y-martin',
	'/boda/daniela-y-martin/i/ABC123',
	'/i/ABC123',
	'/dashboard/invitados',
	'/dashboard/invitaciones',
	'/dashboard/invitaciones/inv_123',
	'/dashboard/invitaciones/inv_123/preview',
	'/dashboard/invitaciones/inv_123/preview/extra',
	'/dashboard/invitaciones/inv_123/editar',
	'/api/dashboard/guests',
	'/api/tracking/events',
	'/api/memories/upload',
	'/wp-admin/index.php',
	'/bautizo/demo-bautismo-angelic-presence',
	'/primera-comunion/demo-primera-comunion-illustrated',
	'/brisa',
	'/jardin-de-luz',
	'/brisa/extra',
	'/america',
];

function toHeaderRecord(entries: Iterable<readonly [string, string]>): Record<string, string> {
	const record: Record<string, string> = {};
	for (const [name, value] of entries) record[name.toLowerCase()] = value;
	return record;
}

function expectedHeaders(pathname: string): Record<string, string> {
	return PREVIEW_PATH.test(pathname) || FRAMEABLE_DEMO_PATHS.has(pathname)
		? EXPECTED_PREVIEW_HEADERS
		: EXPECTED_GLOBAL_HEADERS;
}

function createContext(path: string) {
	return {
		url: new URL(`http://localhost${path}`),
		cookies: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
		redirect: jest.fn(
			(target: string) => new Response(null, { status: 302, headers: { Location: target } }),
		),
		request: { headers: new Map([['user-agent', 'parity-test']]) },
		locals: {},
	} as unknown as APIContext;
}

describe('Middleware security headers', () => {
	it('declares the global security headers', () => {
		expect(toHeaderRecord(SECURITY_HEADERS)).toEqual(EXPECTED_GLOBAL_HEADERS);
	});

	it('declares the invitation preview headers', () => {
		expect(toHeaderRecord(INVITATION_PREVIEW_SECURITY_HEADERS)).toEqual(
			EXPECTED_PREVIEW_HEADERS,
		);
	});

	it.each(SAMPLE_PATHS)('resolves the expected header set for %s', (pathname) => {
		expect(toHeaderRecord(resolveSecurityHeaders(pathname))).toEqual(expectedHeaders(pathname));
	});

	it.each([
		['/boda/daniela-y-martin', 200],
		['/boda/daniela-y-martin', 404],
		['/api/tracking/events', 200],
	])(
		'sets the headers on the response the middleware returns for %s (%i)',
		async (path, status) => {
			const next = jest.fn(async () => new Response(null, { status }));
			const response = await middleware(createContext(path), next);

			expect(response).toBeInstanceOf(Response);
			if (!(response instanceof Response)) throw new Error('Expected a Response.');
			expect(response.status).toBe(status);
			for (const [name, value] of Object.entries(expectedHeaders(path))) {
				expect(response.headers.get(name)).toBe(value);
			}
		},
	);

	it('sets the headers on responses the middleware produces itself', async () => {
		const next = jest.fn(async () => new Response(null, { status: 200 }));
		const path = '/dashboard/invitados';
		const response = await middleware(createContext(path), next);

		if (!(response instanceof Response)) throw new Error('Expected a redirect Response.');
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/login');
		expect(next).not.toHaveBeenCalled();
		for (const [name, value] of Object.entries(expectedHeaders(path))) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it('uses the preview header set on the login redirect for an unauthenticated preview', async () => {
		const next = jest.fn(async () => new Response(null, { status: 200 }));
		const path = '/dashboard/invitaciones/inv_123/preview';
		const response = await middleware(createContext(path), next);

		if (!(response instanceof Response)) throw new Error('Expected a redirect Response.');
		expect(response.status).toBe(302);
		expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
		expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'self'");
		for (const [name, value] of Object.entries(expectedHeaders(path))) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it('rewraps responses whose headers are immutable instead of failing', async () => {
		const immutable = new Response('ok', { status: 200 });
		jest.spyOn(immutable.headers, 'set').mockImplementation(() => {
			throw new TypeError('immutable');
		});
		const next = jest.fn(async () => immutable);
		const response = await middleware(createContext('/boda/daniela-y-martin'), next);

		if (!(response instanceof Response)) throw new Error('Expected a Response.');
		expect(response).not.toBe(immutable);
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(await response.text()).toBe('ok');
	});
});

describe('Middleware permanent redirects', () => {
	it('declares the retired demo URLs', () => {
		expect([...PERMANENT_REDIRECTS]).toEqual(EXPECTED_REDIRECTS);
	});

	it('resolves every retired URL to its destination', () => {
		for (const rule of EXPECTED_REDIRECTS) {
			expect(resolvePermanentRedirectPath(rule.source)).toBe(rule.destination);
		}
	});

	it.each([
		'/boda/daniela-y-martin',
		'/boda/daniela-y-martin/i/ABC123',
		'/bautizo/demo-bautismo-angelic-presence/extra',
		'/demo-bautismo-angelic-presence',
		'/bautizo/demo-bautizo-angelic-presence',
	])('leaves %s alone', (pathname) => {
		expect(resolvePermanentRedirectPath(pathname)).toBeNull();
	});

	it('answers a renamed demo URL with a 301 that keeps the query string', async () => {
		const next = jest.fn(async () => new Response(null, { status: 200 }));
		const response = await middleware(
			createContext('/bautizo/demo-bautismo-angelic-presence?utm_source=whatsapp'),
			next,
		);

		if (!(response instanceof Response)) throw new Error('Expected a Response.');
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('/angelical?utm_source=whatsapp');
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(next).not.toHaveBeenCalled();
	});

	it('answers the renamed demo URLs with a 301', async () => {
		const next = jest.fn(async () => new Response(null, { status: 200 }));
		const response = await middleware(
			createContext('/primera-comunion/demo-primera-comunion-illustrated'),
			next,
		);

		if (!(response instanceof Response)) throw new Error('Expected a Response.');
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('/comunion-angelical');
		expect(next).not.toHaveBeenCalled();
	});
});
