import { resolveSiteOrigin, normalizeOrigin, isLocalOrigin } from '@/lib/shared/origin';

const PUBLIC_SITE_FALLBACK = 'https://www.celebra-me.com';
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;

export function resolvePublicSiteOrigin(options?: {
	configuredOrigin?: string;
	fallbackOrigin?: string;
}): string {
	const configuredOrigin = options?.configuredOrigin ?? resolveSiteOrigin();
	const fallbackOrigin = options?.fallbackOrigin ?? PUBLIC_SITE_FALLBACK;

	if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
		return normalizeOrigin(configuredOrigin);
	}

	return normalizeOrigin(fallbackOrigin);
}

function inferImageType(url: string): string {
	const pathname = new URL(url).pathname.toLowerCase();
	if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
	if (pathname.endsWith('.png')) return 'image/png';
	if (pathname.endsWith('.gif')) return 'image/gif';
	if (pathname.endsWith('.webp')) return 'image/webp';
	return 'image/jpeg';
}

export function buildAbsoluteSocialUrl(pathOrUrl: string, origin: string): string {
	const safeOrigin = resolvePublicSiteOrigin({ configuredOrigin: origin });

	try {
		const parsed = new URL(pathOrUrl);
		if (!isLocalOrigin(parsed.origin)) return parsed.href;
		return new URL(parsed.pathname + parsed.search + parsed.hash, safeOrigin).href;
	} catch {
		return new URL(pathOrUrl, safeOrigin).href;
	}
}

export function buildSocialImageMetadata(
	pathOrUrl: string,
	options: {
		origin: string;
		width?: number;
		height?: number;
		type?: string;
	},
): { url: string; width: number; height: number; type: string } {
	const url = buildAbsoluteSocialUrl(pathOrUrl, options.origin);
	return {
		url,
		width: options.width ?? DEFAULT_IMAGE_WIDTH,
		height: options.height ?? DEFAULT_IMAGE_HEIGHT,
		type: options.type ?? inferImageType(url),
	};
}
