import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
 * Both `vercel.json` and `src/middleware.ts` declare the same security headers and
 * permanent redirects while Vercel and Cloudflare Workers serve the app side by side.
 * This suite reads `vercel.json` and checks that the middleware answers identically,
 * so neither copy can drift without failing CI.
 */

interface VercelHeaderRule {
	source: string;
	headers: Array<{ key: string; value: string }>;
}

interface VercelRedirectRule {
	source: string;
	destination: string;
	permanent?: boolean;
}

interface VercelConfig {
	headers?: VercelHeaderRule[];
	redirects?: VercelRedirectRule[];
}

/** The adapter writes the immutable cache rule for hashed assets; it is not a middleware concern. */
const STATIC_ASSET_SOURCE = '/_astro/(.*)';

const SAMPLE_PARAM_VALUES: Record<string, string> = {
	eventType: 'boda',
	slug: 'daniela-y-martin',
	id: 'inv_123',
};

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
	'/dashboard/invitaciones/inv_123/editar',
	'/api/dashboard/guests',
	'/api/tracking/events',
	'/api/memories/upload',
	'/wp-admin/index.php',
	'/bautizo/demo-bautismo-angelic-presence',
	'/primera-comunion/demo-primera-comunion-illustrated',
];

function readVercelConfig(): VercelConfig {
	return JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as VercelConfig;
}

/**
 * Compiles a Vercel `source` into a RegExp. Vercel sources are path-to-regexp
 * patterns: `:param` matches one segment and parenthesised groups are raw regex.
 */
function compileVercelSource(source: string): RegExp {
	return new RegExp(`^${source.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '[^/]+')}$`);
}

function substituteParams(template: string): string {
	return template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
		const value = SAMPLE_PARAM_VALUES[name];
		if (value === undefined) throw new Error(`No sample value for :${name}`);
		return value;
	});
}

function toHeaderRecord(entries: Iterable<readonly [string, string]>): Record<string, string> {
	const record: Record<string, string> = {};
	for (const [name, value] of entries) record[name.toLowerCase()] = value;
	return record;
}

function expectedVercelHeaders(config: VercelConfig, pathname: string): Record<string, string> {
	const matching = (config.headers ?? [])
		.filter((rule) => rule.source !== STATIC_ASSET_SOURCE)
		.filter((rule) => compileVercelSource(rule.source).test(pathname))
		.flatMap((rule) => rule.headers.map((header) => [header.key, header.value] as const));
	return toHeaderRecord(matching);
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

describe('Platform parity: vercel.json vs. middleware security headers', () => {
	const config = readVercelConfig();

	it('declares the same global security headers as vercel.json', () => {
		const globalRule = (config.headers ?? []).find((rule) =>
			rule.headers.some(
				(header) => header.key === 'X-Frame-Options' && header.value === 'DENY',
			),
		);
		expect(globalRule).toBeDefined();
		expect(toHeaderRecord(SECURITY_HEADERS)).toEqual(
			toHeaderRecord(
				globalRule!.headers.map((header) => [header.key, header.value] as const),
			),
		);
	});

	it('declares the same invitation preview headers as vercel.json', () => {
		const previewRule = (config.headers ?? []).find((rule) =>
			rule.headers.some(
				(header) => header.key === 'X-Frame-Options' && header.value === 'SAMEORIGIN',
			),
		);
		expect(previewRule).toBeDefined();
		expect(toHeaderRecord(INVITATION_PREVIEW_SECURITY_HEADERS)).toEqual(
			toHeaderRecord(
				previewRule!.headers.map((header) => [header.key, header.value] as const),
			),
		);
	});

	it.each(SAMPLE_PATHS)('resolves the same header set as vercel.json for %s', (pathname) => {
		const expected = expectedVercelHeaders(config, pathname);
		expect(Object.keys(expected).length).toBeGreaterThan(0);
		expect(toHeaderRecord(resolveSecurityHeaders(pathname))).toEqual(expected);
	});

	it('does not leave any vercel.json header rule unmatched by the sample paths', () => {
		const unmatched = (config.headers ?? [])
			.filter((rule) => rule.source !== STATIC_ASSET_SOURCE)
			.filter(
				(rule) => !SAMPLE_PATHS.some((path) => compileVercelSource(rule.source).test(path)),
			);
		expect(unmatched.map((rule) => rule.source)).toEqual([]);
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
			for (const [name, value] of Object.entries(expectedVercelHeaders(config, path))) {
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
		for (const [name, value] of Object.entries(expectedVercelHeaders(config, path))) {
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
		for (const [name, value] of Object.entries(expectedVercelHeaders(config, path))) {
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

describe('Platform parity: vercel.json vs. middleware permanent redirects', () => {
	const config = readVercelConfig();

	it('declares the same redirect rules as vercel.json, all permanent', () => {
		const vercelRedirects = (config.redirects ?? []).map((rule) => ({
			source: rule.source,
			destination: rule.destination,
		}));
		expect(vercelRedirects.length).toBeGreaterThan(0);
		for (const rule of config.redirects ?? []) expect(rule.permanent).toBe(true);
		expect([...PERMANENT_REDIRECTS]).toEqual(vercelRedirects);
	});

	it('resolves every vercel.json redirect to the same destination', () => {
		for (const rule of config.redirects ?? []) {
			const samplePath = substituteParams(rule.source);
			expect(compileVercelSource(rule.source).test(samplePath)).toBe(true);
			expect(resolvePermanentRedirectPath(samplePath)).toBe(
				substituteParams(rule.destination),
			);
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
		expect(response.headers.get('Location')).toBe(
			'/bautizo/demo-bautizo-angelic-presence?utm_source=whatsapp',
		);
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
		expect(response.headers.get('Location')).toBe(
			'/primera-comunion/demo-primera-comunion-angelic-presence',
		);
		expect(next).not.toHaveBeenCalled();
	});
});
