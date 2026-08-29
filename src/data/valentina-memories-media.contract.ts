/**
 * Single source of truth for the Valentina Memories media lifecycle.
 *
 * Upload limits and object prefix remain owned by
 * `valentina-memories-upload.contract.ts`. This contract only adds the
 * catalog, guest-session, moderation, and private-retrieval semantics.
 */

import {
	VALENTINA_MEMORIES_ALLOWED_MIME_TYPES,
	VALENTINA_MEMORIES_EVENT_ID,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS,
	getValentinaMemoriesMimePolicy,
} from './valentina-memories-upload.contract';

export const VALENTINA_MEMORIES_EVENT_SLUG = 'valentina-hernandez' as const;
export const VALENTINA_MEMORIES_SESSION_COOKIE = 'valentina_memories_session' as const;
export const VALENTINA_MEMORIES_SESSION_TTL_SECONDS = VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS;
export const VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH = 14;
export const VALENTINA_MEMORIES_MAX_CAPTION_LENGTH = 240;
export const VALENTINA_MEMORIES_MAX_ITEMS_PER_SESSION = 100;
export const VALENTINA_MEMORIES_AUDIT_RETENTION_DAYS = 365;
export const VALENTINA_MEMORIES_AUDIT_RETENTION_SECONDS =
	VALENTINA_MEMORIES_AUDIT_RETENTION_DAYS * 24 * 60 * 60;

export const VALENTINA_MEMORIES_RETRIEVAL_PATH = '/retrieve/valentina' as const;
export const VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME =
	'VALENTINA_MEMORIES_RETRIEVAL_URL' as const;
export const VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME =
	'VALENTINA_MEMORIES_RETRIEVAL_SHARED_SECRET' as const;
export const VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS = 60;

export const VALENTINA_MEMORIES_MEDIA_STATUSES = [
	'uploading',
	'validating',
	'accepted',
	'rejected',
	'deleted',
] as const;
export type ValentinaMemoriesMediaStatus = (typeof VALENTINA_MEMORIES_MEDIA_STATUSES)[number];

export const VALENTINA_MEMORIES_MEDIA_TRANSITIONS: Record<
	ValentinaMemoriesMediaStatus,
	readonly ValentinaMemoriesMediaStatus[]
> = {
	uploading: ['validating', 'deleted'],
	validating: ['accepted', 'rejected', 'deleted'],
	accepted: ['rejected', 'deleted'],
	rejected: ['validating', 'accepted', 'deleted'],
	deleted: ['validating'],
};

export type ValentinaMemoriesMediaActor = 'guest' | 'organizer' | 'system';

export interface ValentinaMemoriesMediaItem {
	id: string;
	eventKey: typeof VALENTINA_MEMORIES_EVENT_ID;
	sessionId: string;
	mimeType: keyof typeof VALENTINA_MEMORIES_ALLOWED_MIME_TYPES;
	sizeBytes: number;
	durationSeconds: number | null;
	caption: string;
	status: ValentinaMemoriesMediaStatus;
	createdAt: string;
	updatedAt: string;
	acceptedAt: string | null;
	rejectedAt: string | null;
	deletedAt: string | null;
}

export type ValentinaMemoriesMediaPublicItem = Omit<
	ValentinaMemoriesMediaItem,
	'sessionId' | 'eventKey'
>;

export function canTransitionValentinaMemoriesMedia(
	from: ValentinaMemoriesMediaStatus,
	to: ValentinaMemoriesMediaStatus,
): boolean {
	return VALENTINA_MEMORIES_MEDIA_TRANSITIONS[from].includes(to);
}

export function sanitizeValentinaMemoriesCaption(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, VALENTINA_MEMORIES_MAX_CAPTION_LENGTH);
}

export function isValentinaMemoriesObjectKeyForMime(
	objectKey: unknown,
	mimeType: unknown,
): objectKey is string {
	if (typeof objectKey !== 'string' || typeof mimeType !== 'string') return false;
	if (!objectKey.startsWith(VALENTINA_MEMORIES_OBJECT_PREFIX)) return false;
	const policy = getValentinaMemoriesMimePolicy(mimeType);
	if (!policy) return false;
	const suffix = objectKey.slice(VALENTINA_MEMORIES_OBJECT_PREFIX.length);
	const expectedExtension = policy.extension;
	return new RegExp(
		`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.${expectedExtension}$`,
		'i',
	).test(suffix);
}

export function getValentinaMemoriesRecoveryCodePattern(): RegExp {
	return /^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){2}$/;
}

export function buildValentinaMemoriesRetrievalSigningPayload(input: {
	timestamp: string;
	method: string;
	path: string;
	bodyHash: string;
}): string {
	return [input.timestamp, input.method.toUpperCase(), input.path, input.bodyHash].join('.');
}
