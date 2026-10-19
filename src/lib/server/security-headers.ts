/**
 * Security headers and legacy redirects, served from the Astro middleware.
 * `tests/integration/security-headers-middleware.test.ts` pins the served values.
 *
 * The immutable cache header for `/_astro/*` is intentionally not handled
 * here: static assets never reach the middleware, and each adapter writes
 * that rule for its own CDN.
 */

export type HeaderEntry = readonly [name: string, value: string];

/** Security headers applied to every response except the invitation preview frame. */
export const SECURITY_HEADERS: readonly HeaderEntry[] = [
	['X-Content-Type-Options', 'nosniff'],
	['X-Frame-Options', 'DENY'],
	['X-XSS-Protection', '1; mode=block'],
	['Referrer-Policy', 'strict-origin-when-cross-origin'],
	['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
	['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
];

/**
 * The dashboard embeds `/dashboard/invitaciones/:id/preview` in an iframe, so
 * that page must allow same-origin framing instead of denying it outright.
 */
export const INVITATION_PREVIEW_SECURITY_HEADERS: readonly HeaderEntry[] = [
	['X-Content-Type-Options', 'nosniff'],
	['X-Frame-Options', 'SAMEORIGIN'],
	['Content-Security-Policy', "frame-ancestors 'self'"],
	['X-XSS-Protection', '1; mode=block'],
	['Referrer-Policy', 'strict-origin-when-cross-origin'],
	['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
	['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
];

const INVITATION_PREVIEW_PATH = /^\/dashboard\/invitaciones\/[^/]+\/preview$/;

function isInvitationPreviewPath(pathname: string): boolean {
	return INVITATION_PREVIEW_PATH.test(pathname);
}

export function resolveSecurityHeaders(pathname: string): readonly HeaderEntry[] {
	return isInvitationPreviewPath(pathname)
		? INVITATION_PREVIEW_SECURITY_HEADERS
		: SECURITY_HEADERS;
}

function hasMutableHeaderApi(response: unknown): response is Response {
	return (
		typeof response === 'object' &&
		response !== null &&
		typeof (response as { headers?: { set?: unknown } }).headers?.set === 'function'
	);
}

/**
 * Sets the security headers on a response. Responses produced by `fetch()` carry
 * an immutable header guard, so those are rewrapped before the headers are added.
 * Values that are not real `Response` objects are returned untouched.
 */
export function withSecurityHeaders(pathname: string, response: Response): Response {
	if (!hasMutableHeaderApi(response)) return response;

	const entries = resolveSecurityHeaders(pathname);
	try {
		for (const [name, value] of entries) response.headers.set(name, value);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		for (const [name, value] of entries) headers.set(name, value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

export interface PermanentRedirectRule {
	/** Source path: literal segments or `:param` placeholders (one segment each). */
	readonly source: string;
	/** Destination with the same `:param` placeholders, substituted from the match. */
	readonly destination: string;
}

/** Permanent (301) redirects for retired URLs. */
export const PERMANENT_REDIRECTS: readonly PermanentRedirectRule[] = [
	{
		source: '/bautizo/demo-bautismo-angelic-presence',
		destination: '/bautizo/demo-bautizo-angelic-presence',
	},
	{
		source: '/primera-comunion/demo-primera-comunion-illustrated',
		destination: '/primera-comunion/demo-primera-comunion-angelic-presence',
	},
];

const PARAM_PLACEHOLDER = /:([A-Za-z_][A-Za-z0-9_]*)/g;

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface CompiledRedirect {
	readonly pattern: RegExp;
	readonly paramNames: readonly string[];
	readonly destination: string;
}

function compileRedirect(rule: PermanentRedirectRule): CompiledRedirect {
	const paramNames: string[] = [];
	let pattern = '';
	let lastIndex = 0;
	for (const match of rule.source.matchAll(PARAM_PLACEHOLDER)) {
		pattern += escapeRegExp(rule.source.slice(lastIndex, match.index));
		pattern += '([^/]+)';
		paramNames.push(match[1]);
		lastIndex = match.index + match[0].length;
	}
	pattern += escapeRegExp(rule.source.slice(lastIndex));
	return { pattern: new RegExp(`^${pattern}$`), paramNames, destination: rule.destination };
}

const COMPILED_REDIRECTS = PERMANENT_REDIRECTS.map(compileRedirect);

/** Returns the redirect target for a pathname, or `null` when no rule applies. */
export function resolvePermanentRedirectPath(pathname: string): string | null {
	for (const redirect of COMPILED_REDIRECTS) {
		const match = redirect.pattern.exec(pathname);
		if (!match) continue;
		const params = new Map(redirect.paramNames.map((name, index) => [name, match[index + 1]]));
		return redirect.destination.replace(PARAM_PLACEHOLDER, (_, name: string) => {
			const value = params.get(name);
			return value === undefined ? `:${name}` : value;
		});
	}
	return null;
}

/**
 * Builds the 301 response for a retired URL, keeping the query string, or
 * returns `null` when the URL is not covered by any rule.
 */
export function resolvePermanentRedirect(url: URL): Response | null {
	const target = resolvePermanentRedirectPath(url.pathname);
	if (target === null) return null;
	return new Response(null, {
		status: 301,
		headers: { Location: `${target}${url.search}` },
	});
}
