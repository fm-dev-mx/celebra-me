/**
 * App ↔ Worker private request contract and public routing constants.
 *
 * This module must stay free of imports so Wrangler can bundle it by relative path.
 */

export const MEMORIES_PRIVATE_REQUEST_HEADERS = {
	audience: 'X-Celebra-Memories-Audience',
	timestamp: 'X-Celebra-Memories-Timestamp',
	requestId: 'X-Celebra-Memories-Request-Id',
	signature: 'X-Celebra-Memories-Signature',
} as const;

export const MEMORIES_PRIVATE_REQUEST_TTL_SECONDS = 60;
export const MEMORIES_UPLOAD_REQUEST_AUDIENCE = 'memories-upload-sign-v1' as const;
export const MEMORIES_RETRIEVAL_REQUEST_AUDIENCE = 'memories-private-retrieval-v1' as const;

/** Worker routes. Event-neutral: the signed envelope carries the authority. */
export const MEMORIES_SIGN_PATH = '/sign' as const;
export const MEMORIES_UPLOAD_PATH = '/upload' as const;
export const MEMORIES_RETRIEVAL_PATH = '/retrieve' as const;

export function buildMemoriesPrivateRequestPayload(input: {
	audience: string;
	timestamp: string;
	requestId: string;
	method: string;
	path: string;
	bodyHash: string;
}): string {
	return [
		'v1',
		input.audience,
		input.timestamp,
		input.requestId,
		input.method.toUpperCase(),
		input.path,
		input.bodyHash,
	].join('\n');
}

/**
 * Printed QR contract: Production always prints this origin, never BASE_URL or a
 * deployment URL, because a printed code must resolve for years. Only Preview
 * and local runs swap in their own serving origin, decided on the server by
 * resolveMemoriesPublicOrigin.
 */
export const MEMORIES_PUBLIC_ORIGIN = 'https://celebra-me.com' as const;
export const MEMORIES_PUBLIC_ROUTE_PREFIX = '/r/' as const;
export const MEMORIES_PUBLIC_SLUG_MAX_LENGTH = 64;
export const MEMORIES_PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isMemoriesPublicSlug(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length <= MEMORIES_PUBLIC_SLUG_MAX_LENGTH &&
		MEMORIES_PUBLIC_SLUG_PATTERN.test(value)
	);
}

export function buildMemoriesPublicPath(publicSlug: string): string {
	return `${MEMORIES_PUBLIC_ROUTE_PREFIX}${publicSlug}`;
}

export function buildMemoriesRecoveryPath(publicSlug: string): string {
	return `${buildMemoriesPublicPath(publicSlug)}/recuperar`;
}

export function buildMemoriesPublicUrl(
	publicSlug: string,
	origin: string = MEMORIES_PUBLIC_ORIGIN,
): string {
	return `${origin}${buildMemoriesPublicPath(publicSlug)}`;
}

/** HMAC-SHA256 in base64url: 43 characters, no padding. */
export const MEMORIES_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function buildMemoriesGalleryPath(publicSlug: string, token: string): string {
	return `${buildMemoriesPublicPath(publicSlug)}/galeria/${token}`;
}

export function buildMemoriesGalleryUrl(
	publicSlug: string,
	token: string,
	origin: string = MEMORIES_PUBLIC_ORIGIN,
): string {
	return `${origin}${buildMemoriesGalleryPath(publicSlug, token)}`;
}

export function buildMemoriesGalleryApiPath(publicSlug: string, token: string): string {
	return `${buildMemoriesGuestApiPath(publicSlug)}/gallery/${token}`;
}

export function buildMemoriesGuestApiPath(publicSlug: string): string {
	return `/api/memories/${publicSlug}`;
}

export function buildMemoriesOrganizerApiPath(eventId: string): string {
	return `/api/dashboard/memories/${eventId}`;
}

export const MEMORIES_ADMIN_API_PATH = '/api/dashboard/admin/memories' as const;
export const MEMORIES_ORGANIZER_PAGE_PATH = '/dashboard/memories' as const;
export const MEMORIES_ORGANIZER_LOGIN_PATH = '/login?next=%2Fdashboard%2Fmemories' as const;

/** `__Host-` cookies require Secure and Path=/, so one cookie per event by name. */
export function buildMemoriesSessionCookieName(publicSlug: string): string {
	return `__Host-memories_${publicSlug}`;
}
