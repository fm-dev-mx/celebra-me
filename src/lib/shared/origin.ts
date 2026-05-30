import { getEnv } from '@/lib/server/env';

const LOCAL_FALLBACK = 'http://localhost:4321';

function isValidOrigin(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function normalizeOrigin(value: string): string {
	return value.replace(/\/+$/, '');
}

export function resolveSiteOrigin(options?: { baseUrl?: string }): string {
	if (options?.baseUrl) {
		if (!isValidOrigin(options.baseUrl)) {
			console.warn(
				`[resolveSiteOrigin] Invalid options.baseUrl: "${options.baseUrl}". Falling back.`,
			);
			return LOCAL_FALLBACK;
		}
		return normalizeOrigin(options.baseUrl);
	}

	const envBaseUrl = getEnv('BASE_URL');
	if (envBaseUrl) {
		if (!isValidOrigin(envBaseUrl)) {
			console.warn(
				`[resolveSiteOrigin] Invalid BASE_URL env var: "${envBaseUrl}". Falling back.`,
			);
			return LOCAL_FALLBACK;
		}
		return normalizeOrigin(envBaseUrl);
	}

	return LOCAL_FALLBACK;
}
