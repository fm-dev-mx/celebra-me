/**
 * Single source of truth for Valentina Memories direct-to-R2 upload constraints.
 *
 * QR URL and printable assets stay in `valentina-memories.data.ts`.
 * Worker code and tests must import these values — do not duplicate them.
 */

export const VALENTINA_MEMORIES_EVENT_ID = 'valentina' as const;

export const VALENTINA_MEMORIES_OBJECT_PREFIX = 'events/valentina/' as const;

export const VALENTINA_MEMORIES_SIGN_PATH = '/sign/valentina' as const;

/** Production Worker hostname + sign path. Use this exact public URL. */
export const VALENTINA_MEMORIES_PRODUCTION_SIGN_URL =
	'https://memories.celebra-me.com/sign/valentina' as const;

/** Browser-safe env name. Production value is the URL above. */
export const VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME =
	'PUBLIC_VALENTINA_MEMORIES_SIGN_URL' as const;

export const VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN = 'https://www.celebra-me.com' as const;

export const VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS = 300;

export const VALENTINA_MEMORIES_EVENT_TIME_ZONE = 'America/Mexico_City' as const;

/**
 * Inclusive start of 2026-08-27 in America/Mexico_City (UTC-6 year-round).
 * Exclusive end of 2026-09-03 in the same zone.
 */
export const VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT = '2026-08-27T06:00:00.000Z' as const;
export const VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT = '2026-09-04T06:00:00.000Z' as const;

export const VALENTINA_MEMORIES_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const VALENTINA_MEMORIES_MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS = 60;

export const VALENTINA_MEMORIES_R2_BUCKET = 'celebra-memories' as const;

/** Automatic R2 object expiration for this pilot. Owner-applied lifecycle only. */
export const VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS = 30;
export const VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS =
	VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS * 24 * 60 * 60;

export const VALENTINA_MEMORIES_RATE_LIMIT = {
	bindingName: 'SIGN_RATE_LIMITER',
	namespaceId: '1001',
	limit: 10,
	periodSeconds: 60,
} as const;

export const VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES = 2048;

export type ValentinaMemoriesMimeCategory = 'image' | 'video';

export type ValentinaMemoriesAllowedMimeType =
	| 'image/jpeg'
	| 'image/png'
	| 'image/webp'
	| 'image/heic'
	| 'image/heif'
	| 'video/mp4'
	| 'video/quicktime';

export type ValentinaMemoriesMimePolicy = {
	readonly category: ValentinaMemoriesMimeCategory;
	readonly extension: string;
	readonly maxBytes: number;
};

export const VALENTINA_MEMORIES_ALLOWED_MIME_TYPES = {
	'image/jpeg': {
		category: 'image',
		extension: 'jpg',
		maxBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	},
	'image/png': {
		category: 'image',
		extension: 'png',
		maxBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	},
	'image/webp': {
		category: 'image',
		extension: 'webp',
		maxBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	},
	'image/heic': {
		category: 'image',
		extension: 'heic',
		maxBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	},
	'image/heif': {
		category: 'image',
		extension: 'heif',
		maxBytes: VALENTINA_MEMORIES_MAX_IMAGE_BYTES,
	},
	'video/mp4': {
		category: 'video',
		extension: 'mp4',
		maxBytes: VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
	},
	'video/quicktime': {
		category: 'video',
		extension: 'mov',
		maxBytes: VALENTINA_MEMORIES_MAX_VIDEO_BYTES,
	},
} as const satisfies Record<ValentinaMemoriesAllowedMimeType, ValentinaMemoriesMimePolicy>;

function normalizeMemoriesMimeType(value: string): string {
	return value.trim().toLowerCase();
}

export function getValentinaMemoriesMimePolicy(
	mimeType: string,
): ValentinaMemoriesMimePolicy | null {
	const normalized = normalizeMemoriesMimeType(mimeType);
	if (normalized in VALENTINA_MEMORIES_ALLOWED_MIME_TYPES) {
		return VALENTINA_MEMORIES_ALLOWED_MIME_TYPES[
			normalized as ValentinaMemoriesAllowedMimeType
		];
	}
	return null;
}

export function isAllowedValentinaMemoriesOrigin(origin: string | null | undefined): boolean {
	return origin === VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN;
}

export function isWithinValentinaMemoriesUploadWindow(now: Date): boolean {
	const timestamp = now.getTime();
	return (
		timestamp >= Date.parse(VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT) &&
		timestamp < Date.parse(VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT)
	);
}

export function buildValentinaMemoriesObjectKey(objectId: string, extension: string): string {
	return `${VALENTINA_MEMORIES_OBJECT_PREFIX}${objectId}.${extension}`;
}

export function getValentinaMemoriesPresignExpiresAt(now: Date): Date {
	return new Date(now.getTime() + VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS * 1000);
}
