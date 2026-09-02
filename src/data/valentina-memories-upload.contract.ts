/**
 * Single source of truth for Valentina Memories direct-to-R2 upload constraints.
 *
 * QR URL and printable assets stay in `valentina-memories.data.ts`.
 * Worker code and tests must import these values — do not duplicate them.
 */

export const VALENTINA_MEMORIES_EVENT_ID = 'valentina' as const;

export const VALENTINA_MEMORIES_OBJECT_PREFIX = 'events/valentina/' as const;

export const VALENTINA_MEMORIES_SIGN_PATH = '/sign/valentina' as const;
export const VALENTINA_MEMORIES_UPLOAD_PATH = '/upload/valentina' as const;
export const VALENTINA_MEMORIES_UPLOAD_ORIGIN_ENV_NAME = 'MEMORIES_PRIVATE_UPLOAD_ORIGIN' as const;

export const VALENTINA_MEMORIES_BROWSER_ORIGINS = {
	local: ['http://localhost', 'http://localhost:4321', 'http://127.0.0.1:4321'],
	staging: [
		'https://celebra-me.vercel.app',
		'https://celebra-me-git-feat-valenti-6763f6-francisco-mendoza-s-projects.vercel.app',
	],
	production: ['https://www.celebra-me.com'],
} as const;

export const VALENTINA_MEMORIES_R2_CORS = {
	methods: [],
	headers: [],
} as const;

export const VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS = 300;
export const VALENTINA_MEMORIES_RESERVATION_TTL_SECONDS =
	VALENTINA_MEMORIES_PRESIGN_TTL_SECONDS * 2;

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
export const VALENTINA_MEMORIES_IMAGE_OPTIMIZATION_MAX_DIMENSION_PX = 2560;
export const VALENTINA_MEMORIES_IMAGE_OPTIMIZATION_QUALITY = 0.85;

export const VALENTINA_MEMORIES_STORAGE_TARGETS = {
	local: { bucketName: 'celebra-memories-local' },
	staging: { bucketName: 'celebra-memories-staging' },
	production: { bucketName: 'celebra-memories' },
} as const;
export type ValentinaMemoriesStorageTarget = keyof typeof VALENTINA_MEMORIES_STORAGE_TARGETS;

export type ValentinaMemoriesR2CorsConfig = {
	rules: Array<{
		allowed: {
			origins: string[];
			methods: string[];
			headers: string[];
		};
	}>;
};

export function getValentinaMemoriesStorageBucketName(target: unknown): string | null {
	if (
		typeof target !== 'string' ||
		!Object.hasOwn(VALENTINA_MEMORIES_STORAGE_TARGETS, target)
	)
		return null;
	return VALENTINA_MEMORIES_STORAGE_TARGETS[target as ValentinaMemoriesStorageTarget].bucketName;
}

/** Automatic R2 object expiration for this pilot. Owner-applied lifecycle only. */
export const VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS = 30;
export const VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS =
	VALENTINA_MEMORIES_OBJECT_RETENTION_DAYS * 24 * 60 * 60;

export const VALENTINA_MEMORIES_RATE_LIMIT = {
	bindingName: 'SIGN_RATE_LIMITER',
	namespaceIds: {
		local: '1000',
		staging: '1002',
		production: '1001',
	},
	limit: 6,
	periodSeconds: 60,
} as const;

export const VALENTINA_MEMORIES_SESSION_MAX_FILES = 20;
export const VALENTINA_MEMORIES_SESSION_MAX_VIDEOS = 5;
export const VALENTINA_MEMORIES_SESSION_MAX_BYTES = 512 * 1024 * 1024;
export const VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT = 2;
export const VALENTINA_MEMORIES_EVENT_MAX_OBJECTS = 2_000;
export const VALENTINA_MEMORIES_EVENT_MAX_BYTES = 8_000_000_000;

export const VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES = 2048;
export const VALENTINA_MEMORIES_HASH_CHUNK_BYTES = 2 * 1024 * 1024;

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

export function normalizeMemoriesMimeType(value: string): string {
	return value.trim().toLowerCase();
}

export function getValentinaMemoriesMimePolicy(
	mimeType: string,
): ValentinaMemoriesMimePolicy | null {
	const normalized = normalizeMemoriesMimeType(mimeType);
	if (Object.hasOwn(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES, normalized)) {
		return VALENTINA_MEMORIES_ALLOWED_MIME_TYPES[
			normalized as ValentinaMemoriesAllowedMimeType
		];
	}
	return null;
}

export function resolveValentinaMemoriesFileMimeType(file: {
	type: string;
	name: string;
}): ValentinaMemoriesAllowedMimeType | null {
	const declared = normalizeMemoriesMimeType(file.type);
	if (getValentinaMemoriesMimePolicy(declared))
		return declared as ValentinaMemoriesAllowedMimeType;
	const extension = file.name.trim().toLowerCase().split('.').pop() ?? '';
	if (extension === 'jpeg') return 'image/jpeg';
	const entry = Object.entries(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES).find(
		([, policy]) => policy.extension === extension,
	);
	return (entry?.[0] as ValentinaMemoriesAllowedMimeType | undefined) ?? null;
}

export function getValentinaMemoriesBrowserOrigins(
	target: ValentinaMemoriesStorageTarget,
): readonly string[] {
	return VALENTINA_MEMORIES_BROWSER_ORIGINS[target];
}

export function isAllowedValentinaMemoriesOrigin(
	origin: string | null | undefined,
	target?: ValentinaMemoriesStorageTarget,
): boolean {
	if (!origin) return false;
	if (target) return VALENTINA_MEMORIES_BROWSER_ORIGINS[target].includes(origin as never);
	return Object.values(VALENTINA_MEMORIES_BROWSER_ORIGINS).some((origins) =>
		origins.includes(origin as never),
	);
}

export function buildValentinaMemoriesR2CorsConfig(
	_target: Exclude<ValentinaMemoriesStorageTarget, 'local'>,
): ValentinaMemoriesR2CorsConfig {
	void _target;
	return {
		rules: [
			{
				allowed: {
					origins: [],
					methods: [...VALENTINA_MEMORIES_R2_CORS.methods],
					headers: [...VALENTINA_MEMORIES_R2_CORS.headers],
				},
			},
		],
	};
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
