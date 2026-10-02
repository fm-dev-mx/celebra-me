/**
 * Media policy shared by the app, the browser islands and the Cloudflare Workers.
 *
 * Global by design: the Workers enforce these limits without knowing which event a
 * file belongs to. Per-event limits (event and session quotas, window, retention)
 * live in the database and are enforced by the reservation RPC.
 *
 * This module must stay free of imports so Wrangler can bundle it by relative path.
 */

export const MEMORIES_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MEMORIES_MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MEMORIES_MAX_VIDEO_DURATION_SECONDS = 60;
/** Scale of `event_memory_items.duration_seconds` (`numeric(10, 3)`). */
export const MEMORIES_VIDEO_DURATION_DECIMALS = 3;
export const MEMORIES_IMAGE_OPTIMIZATION_MAX_DIMENSION_PX = 2560;
export const MEMORIES_IMAGE_OPTIMIZATION_QUALITY = 0.85;

export type MemoriesMimeCategory = 'image' | 'video';

export type MemoriesAllowedMimeType =
	| 'image/jpeg'
	| 'image/png'
	| 'image/webp'
	| 'image/heic'
	| 'image/heif'
	| 'video/mp4'
	| 'video/quicktime';

export type MemoriesMimePolicy = {
	readonly category: MemoriesMimeCategory;
	readonly extension: string;
	readonly maxBytes: number;
};

export const MEMORIES_ALLOWED_MIME_TYPES = {
	'image/jpeg': { category: 'image', extension: 'jpg', maxBytes: MEMORIES_MAX_IMAGE_BYTES },
	'image/png': { category: 'image', extension: 'png', maxBytes: MEMORIES_MAX_IMAGE_BYTES },
	'image/webp': { category: 'image', extension: 'webp', maxBytes: MEMORIES_MAX_IMAGE_BYTES },
	'image/heic': { category: 'image', extension: 'heic', maxBytes: MEMORIES_MAX_IMAGE_BYTES },
	'image/heif': { category: 'image', extension: 'heif', maxBytes: MEMORIES_MAX_IMAGE_BYTES },
	'video/mp4': { category: 'video', extension: 'mp4', maxBytes: MEMORIES_MAX_VIDEO_BYTES },
	'video/quicktime': { category: 'video', extension: 'mov', maxBytes: MEMORIES_MAX_VIDEO_BYTES },
} as const satisfies Record<MemoriesAllowedMimeType, MemoriesMimePolicy>;

export const MEMORIES_ALLOWED_EXTENSIONS: readonly string[] = Array.from(
	new Set(Object.values(MEMORIES_ALLOWED_MIME_TYPES).map((policy) => policy.extension)),
);

export function normalizeMemoriesMimeType(value: string): string {
	return value.trim().toLowerCase();
}

export function getMemoriesMimePolicy(mimeType: string): MemoriesMimePolicy | null {
	const normalized = normalizeMemoriesMimeType(mimeType);
	if (Object.hasOwn(MEMORIES_ALLOWED_MIME_TYPES, normalized)) {
		return MEMORIES_ALLOWED_MIME_TYPES[normalized as MemoriesAllowedMimeType];
	}
	return null;
}

/**
 * Browsers report durations with more decimals than the catalog stores. The
 * reservation RPC compares a replayed request against the stored row, so the
 * value must already be at the stored scale when it is first reserved.
 */
export function roundMemoriesVideoDurationSeconds(durationSeconds: number): number {
	const factor = 10 ** MEMORIES_VIDEO_DURATION_DECIMALS;
	return Math.round(durationSeconds * factor) / factor;
}

/** Mirrors the SQL rule `mime_type like 'video/%'` used by the reservation RPC. */
export function isMemoriesVideoMime(mimeType: string): boolean {
	return normalizeMemoriesMimeType(mimeType).startsWith('video/');
}

export function resolveMemoriesFileMimeType(file: {
	type: string;
	name: string;
}): MemoriesAllowedMimeType | null {
	const declared = normalizeMemoriesMimeType(file.type);
	if (getMemoriesMimePolicy(declared)) return declared as MemoriesAllowedMimeType;
	const extension = file.name.trim().toLowerCase().split('.').pop() ?? '';
	if (extension === 'jpeg') return 'image/jpeg';
	const entry = Object.entries(MEMORIES_ALLOWED_MIME_TYPES).find(
		([, policy]) => policy.extension === extension,
	);
	return (entry?.[0] as MemoriesAllowedMimeType | undefined) ?? null;
}
