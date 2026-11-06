/**
 * Security headers and legacy redirects, served from the Astro middleware.
 * `tests/integration/security-headers-middleware.test.ts` pins the served values.
 *
 * The immutable cache header for `/_astro/*` is intentionally not handled
 * here: static assets never reach the middleware, and each adapter writes
 * that rule for its own CDN.
 */

import { findDemoByRouteSlug } from '@/lib/invitation/demo-routes';

export type HeaderEntry = readonly [name: string, value: string];

/**
 * Content-Security-Policy-Report-Only allowlist.
 *
 * Uses `'unsafe-inline'` for `script-src` because 9+ Astro components use `is:inline` scripts
 * and GA4/Meta Pixel/Cloudflare inject scripts via `createElement`. Switching to nonces is
 * deferred to the blocking-mode task after the report-only observation period.
 *
 * Allowlist inventory (external origins):
 * - script-src: googletagmanager.com (GA4), connect.facebook.net (Meta Pixel),
 *   static.cloudflareinsights.com (Cloudflare Web Analytics)
 * - connect-src: googletagmanager.com, analytics.google.com, google-analytics.com (GA4),
 *   connect.facebook.net (Meta Pixel), cloudflareinsights.com (CF beacon),
 *   *.supabase.co + wss (MFA, Realtime), celebra-memories-sign.workers.dev (photo upload)
 * - img-src: media.celebra-me.com, media-staging.celebra-me.com (R2), *.supabase.co (storage)
 * - media-src: media.celebra-me.com, media-staging.celebra-me.com (invitation music)
 * - font-src: self only (@fontsource bundles all fonts locally)
 * - frame-src: self only (dashboard preview iframe, landing showroom)
 */
const CSP_REPORT_ONLY_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://media.celebra-me.com https://media-staging.celebra-me.com https://*.supabase.co",
	"font-src 'self' data:",
	"connect-src 'self' https://www.googletagmanager.com https://analytics.google.com https://www.google-analytics.com https://connect.facebook.net https://cloudflareinsights.com https://*.supabase.co wss://*.supabase.co https://celebra-memories-sign.workers.dev",
	"frame-src 'self'",
	"media-src 'self' blob: https://media.celebra-me.com https://media-staging.celebra-me.com",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	'report-uri /api/security/csp-report',
] as const;

export const CSP_REPORT_ONLY_VALUE = CSP_REPORT_ONLY_DIRECTIVES.join('; ');

/** Security headers applied to every response except the same-origin frames below. */
export const SECURITY_HEADERS: readonly HeaderEntry[] = [
	['X-Content-Type-Options', 'nosniff'],
	['X-Frame-Options', 'DENY'],
	['X-XSS-Protection', '0'],
	['Referrer-Policy', 'strict-origin-when-cross-origin'],
	['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
	['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
	['Content-Security-Policy-Report-Only', CSP_REPORT_ONLY_VALUE],
];

/**
 * The dashboard embeds `/dashboard/invitaciones/:id/preview` and the landing showroom embeds the
 * demo short routes (`/brisa`) in an iframe, so those pages allow same-origin framing instead of
 * denying it outright.
 */
export const INVITATION_PREVIEW_SECURITY_HEADERS: readonly HeaderEntry[] = [
	['X-Content-Type-Options', 'nosniff'],
	['X-Frame-Options', 'SAMEORIGIN'],
	['Content-Security-Policy', "frame-ancestors 'self'"],
	['X-XSS-Protection', '0'],
	['Referrer-Policy', 'strict-origin-when-cross-origin'],
	['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
	['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
	['Content-Security-Policy-Report-Only', CSP_REPORT_ONLY_VALUE],
];

const INVITATION_PREVIEW_PATH = /^\/dashboard\/invitaciones\/[^/]+\/preview$/;

const SHORT_ROUTE_PATH = /^\/([a-z0-9-]+)$/;

function isInvitationPreviewPath(pathname: string): boolean {
	return INVITATION_PREVIEW_PATH.test(pathname);
}

/** Demo short routes only: public sample content, never a guest's invitation. */
function isDemoShortRoutePath(pathname: string): boolean {
	const routeSlug = SHORT_ROUTE_PATH.exec(pathname)?.[1];
	return routeSlug !== undefined && findDemoByRouteSlug(routeSlug) !== undefined;
}

export function resolveSecurityHeaders(pathname: string): readonly HeaderEntry[] {
	return isInvitationPreviewPath(pathname) || isDemoShortRoutePath(pathname)
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
