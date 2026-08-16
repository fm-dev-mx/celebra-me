const PUBLIC_SITE_FALLBACK = 'https://www.celebra-me.com';
const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 630;

function normalizeOrigin(value: string): string {
	return value.replace(/\/+$/, '');
}

function isLocalOrigin(origin: string): boolean {
	try {
		const { hostname } = new URL(origin);
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return true;
	}
}

export function resolvePublicSiteOrigin(options?: {
	configuredOrigin?: string;
	fallbackOrigin?: string;
}): string {
	const configuredOrigin = options?.configuredOrigin ?? '';
	const fallbackOrigin = options?.fallbackOrigin ?? PUBLIC_SITE_FALLBACK;

	if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
		return normalizeOrigin(configuredOrigin);
	}

	return normalizeOrigin(fallbackOrigin);
}

const CLOUDINARY_UPLOAD_PATTERN =
	/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/i;
const CLOUDINARY_VERSIONED_ASSET = /(?:^|\/)(v\d+\/.*)$/;
export const CLOUDINARY_SOCIAL_TRANSFORMATION = 'c_fill,w_1200,h_630,g_auto,q_auto:good,f_jpg';

function toJpgDeliveryPath(path: string): string {
	return path.replace(/\.(webp|png|jpeg|jpg|gif)$/i, '.jpg');
}

export function toOptimizedSocialImageUrl(url: string): string {
	const match = url.match(CLOUDINARY_UPLOAD_PATTERN);
	if (!match) return url;

	const [, prefix, rest] = match;
	if (rest.startsWith(`${CLOUDINARY_SOCIAL_TRANSFORMATION}/`)) {
		return url;
	}

	const versionedAsset = rest.match(CLOUDINARY_VERSIONED_ASSET)?.[1] ?? rest;
	return `${prefix}${CLOUDINARY_SOCIAL_TRANSFORMATION}/${toJpgDeliveryPath(versionedAsset)}`;
}

function inferImageType(url: string): string {
	if (url.includes('f_jpg') || url.includes('f_jpeg')) return 'image/jpeg';
	if (url.includes('f_png')) return 'image/png';
	if (url.includes('f_webp')) return 'image/webp';

	try {
		const pathname = new URL(url).pathname.toLowerCase();
		if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
		if (pathname.endsWith('.png')) return 'image/png';
		if (pathname.endsWith('.gif')) return 'image/gif';
		if (pathname.endsWith('.webp')) return 'image/webp';
	} catch {
		// fall through
	}
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

export interface SocialImageMetadata {
	url: string;
	width: number;
	height: number;
	type: string;
}

export function buildSocialImageMetadata(
	pathOrUrl: string,
	options: {
		origin: string;
		width?: number;
		height?: number;
		type?: string;
	},
): SocialImageMetadata {
	const absoluteUrl = buildAbsoluteSocialUrl(pathOrUrl, options.origin);
	const optimizedUrl = toOptimizedSocialImageUrl(absoluteUrl);
	return {
		url: optimizedUrl,
		width: options.width ?? DEFAULT_IMAGE_WIDTH,
		height: options.height ?? DEFAULT_IMAGE_HEIGHT,
		type: options.type ?? inferImageType(optimizedUrl),
	};
}
