import {
	buildCloudflareAccessHeaders,
	CLOUDFLARE_PREVIEW_HOST_PATTERN,
	CLOUDFLARE_PRODUCTION_VERSION_HOST_PATTERN,
} from '../../playwright/preview-environment.ts';

/**
 * Read-only remote capture targets. This mode is separate from the Preview E2E guards in
 * `preview-environment.ts` (which keep refusing Production): it only ever issues GET requests
 * and blocks every other method in the browser, so it may look at the public Production domain.
 */
const REMOTE_PRODUCTION_ORIGIN = 'https://www.celebra-me.com';

export type RemoteTargetKind = 'production-domain' | 'production-version' | 'preview-worker';

export interface RemoteTarget {
	origin: string;
	host: string;
	kind: RemoteTargetKind;
	/** Cloudflare Access service-token headers; sent only to this exact origin. */
	accessHeaders?: Record<string, string>;
}

function parseOrigin(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		throw new Error('Remote visual origin must be an absolute HTTPS URL.');
	}
	if (url.protocol !== 'https:') {
		throw new Error('Remote visual origin must use HTTPS.');
	}
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		(url.pathname && url.pathname !== '/')
	) {
		throw new Error('Remote visual origin must contain only scheme and host.');
	}
	return url;
}

export function classifyRemoteHost(host: string): RemoteTargetKind | undefined {
	const hostname = host.toLowerCase();
	if (`https://${hostname}` === REMOTE_PRODUCTION_ORIGIN) return 'production-domain';
	if (CLOUDFLARE_PRODUCTION_VERSION_HOST_PATTERN.test(hostname)) return 'production-version';
	if (CLOUDFLARE_PREVIEW_HOST_PATTERN.test(hostname)) return 'preview-worker';
	return undefined;
}

/**
 * Resolves an allow-listed origin. Worker hosts sit behind Cloudflare Access and require the
 * service token from `CLOUDFLARE_ACCESS_CLIENT_ID` / `CLOUDFLARE_ACCESS_CLIENT_SECRET`.
 * Error messages never include header values.
 */
export function resolveRemoteTarget(
	rawOrigin: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
): RemoteTarget {
	if (!rawOrigin?.trim()) throw new Error('Remote visual capture requires --origin.');
	const url = parseOrigin(rawOrigin);
	if (url.port) throw new Error('Remote visual origin must not set a port.');
	const kind = classifyRemoteHost(url.hostname);
	if (!kind) {
		throw new Error(
			`Remote visual origin ${url.hostname} is not allow-listed (www.celebra-me.com or a Cloudflare Production/Preview Worker host).`,
		);
	}
	const target: RemoteTarget = { origin: url.origin, host: url.hostname, kind };
	if (kind === 'production-domain') return target;
	const accessHeaders = buildCloudflareAccessHeaders(env);
	if (!accessHeaders) {
		throw new Error(
			'Cloudflare Worker hosts require CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET.',
		);
	}
	return { ...target, accessHeaders };
}

/** Methods the remote capture may send. Everything else is aborted before it leaves the browser. */
const REMOTE_READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Third-party measurement endpoints: aborted so captures neither count visits nor vary. */
const BLOCKED_THIRD_PARTY_HOSTS = [
	/(^|\.)google-analytics\.com$/,
	/(^|\.)googletagmanager\.com$/,
	/(^|\.)doubleclick\.net$/,
	/(^|\.)vercel-insights\.com$/,
	/(^|\.)cloudflareinsights\.com$/,
];

export type RemoteRequestDecision = 'continue' | 'continue-with-access' | 'abort';

/** Decides what the browser may do with one request during a remote capture. */
export function decideRemoteRequest(
	target: Pick<RemoteTarget, 'origin' | 'accessHeaders'>,
	method: string,
	requestUrl: string,
): RemoteRequestDecision {
	if (!REMOTE_READ_METHODS.has(method.toUpperCase())) return 'abort';
	let url: URL;
	try {
		url = new URL(requestUrl);
	} catch {
		return 'continue';
	}
	if (url.origin === target.origin) {
		// First-party tracking beacons write engagement rows even over GET.
		if (url.pathname.startsWith('/api/tracking/')) return 'abort';
		return target.accessHeaders ? 'continue-with-access' : 'continue';
	}
	if (BLOCKED_THIRD_PARTY_HOSTS.some((pattern) => pattern.test(url.hostname))) return 'abort';
	return 'continue';
}
