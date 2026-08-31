import { getEnv } from '@/lib/server/env';

function isAllowedLocalOrigin(url: URL): boolean {
	return (
		url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
	);
}

/** Resolves an exact server-only Worker origin and a repository-owned path. */
export function resolveMemoriesPrivateWorkerUrl(envName: string, path: string): URL | null {
	const raw = getEnv(envName).trim();
	if (!raw) return null;
	try {
		const origin = new URL(raw);
		if (
			(origin.protocol !== 'https:' && !isAllowedLocalOrigin(origin)) ||
			origin.pathname !== '/' ||
			origin.username ||
			origin.password ||
			origin.search ||
			origin.hash
		) {
			return null;
		}
		return new URL(path, origin);
	} catch {
		return null;
	}
}
