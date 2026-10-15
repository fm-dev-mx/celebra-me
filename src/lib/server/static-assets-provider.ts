/**
 * Reads the site's own static files. A Worker cannot fetch its own origin: version URLs sit
 * behind Cloudflare Access, `workers.dev` refuses self-requests, and behind zone routes the
 * request reaches the zone origin instead of the Worker. The Worker entry installs the
 * adapter's `ASSETS` binding before the first request (`src/worker.ts`); every other host
 * (Vercel, the dev server, tests) serves its own origin and keeps `fetch`.
 */

interface AssetsBinding {
	fetch(request: Request): Promise<Response>;
}

let installedBinding: AssetsBinding | undefined;

function isAssetsBinding(value: unknown): value is AssetsBinding {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { fetch?: unknown }).fetch === 'function'
	);
}

/** Adopts `env.ASSETS` from a Worker invocation; a missing binding leaves `fetch` selected. */
export function installAssetsBinding(env: Record<string, unknown> | undefined): boolean {
	const candidate = env?.ASSETS;
	if (!isAssetsBinding(candidate)) return false;
	installedBinding = candidate;
	return true;
}

/** Forgets the installed binding (tests). */
export function resetAssetsBindingForTests(): void {
	installedBinding = undefined;
}

/** Fetches a URL on the request's own origin, through the `ASSETS` binding when installed. */
export function fetchOwnStaticAsset(url: URL, init?: RequestInit): Promise<Response> {
	if (installedBinding) return installedBinding.fetch(new Request(url.href, init));
	return fetch(url, init);
}
