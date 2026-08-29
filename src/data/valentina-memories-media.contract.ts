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
	VALENTINA_MEMORIES_RATE_LIMIT,
	getValentinaMemoriesMimePolicy,
} from './valentina-memories-upload.contract';

export const VALENTINA_MEMORIES_EVENT_SLUG = 'valentina-hernandez' as const;
export const VALENTINA_MEMORIES_SESSION_COOKIE = '__Host-valentina_memories_session' as const;
export const VALENTINA_MEMORIES_SESSION_TTL_SECONDS = VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS;
export const VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH = 14;
export const VALENTINA_MEMORIES_DISPLAY_NAME_MIN_LENGTH = 1;
export const VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH = 60;
export const VALENTINA_MEMORIES_MAX_CAPTION_LENGTH = 240;
const VALENTINA_MEMORIES_AUDIT_RETENTION_DAYS = 365;
export const VALENTINA_MEMORIES_AUDIT_RETENTION_SECONDS =
	VALENTINA_MEMORIES_AUDIT_RETENTION_DAYS * 24 * 60 * 60;

export const VALENTINA_MEMORIES_RETRIEVAL_PATH = '/retrieve/valentina' as const;
export const VALENTINA_MEMORIES_RETRIEVAL_ORIGIN_ENV_NAME =
	'MEMORIES_PRIVATE_RETRIEVAL_ORIGIN' as const;
export const VALENTINA_MEMORIES_UPLOAD_SIGNING_PRIVATE_KEY_ENV_NAME =
	'MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY' as const;
export const VALENTINA_MEMORIES_RETRIEVAL_SIGNING_PRIVATE_KEY_ENV_NAME =
	'MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY' as const;
export const VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS = 60;
export const VALENTINA_MEMORIES_CLEANUP_BATCH_SIZE = 25;
export const VALENTINA_MEMORIES_CLEANUP_LEASE_SECONDS = 15 * 60;
export const VALENTINA_MEMORIES_CATALOG_PAGE_SIZE = 50;
export const VALENTINA_MEMORIES_VALIDATION_RETRY_DELAY_SECONDS = 60;
export const VALENTINA_MEMORIES_APP_RATE_LIMITS = {
	session: { maxHits: 60, windowSec: 60 },
	recover: { maxHits: 5, windowSec: 60 },
	register: {
		maxHits: VALENTINA_MEMORIES_RATE_LIMIT.limit,
		windowSec: VALENTINA_MEMORIES_RATE_LIMIT.periodSeconds,
	},
	read: { maxHits: 60, windowSec: 60 },
	mutate: { maxHits: 30, windowSec: 60 },
} as const;

export const VALENTINA_MEMORIES_ARCHIVE_MAX_FILES = 100 as const;
export const VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES = 134_217_728 as const; // 128 MiB
export const VALENTINA_MEMORIES_SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

export const VALENTINA_MEMORIES_MEDIA_STATUSES = [
	'uploading',
	'validating',
	'accepted',
	'rejected',
	'deleted',
	'duplicate',
] as const;
export type ValentinaMemoriesMediaStatus = (typeof VALENTINA_MEMORIES_MEDIA_STATUSES)[number];

export const VALENTINA_MEMORIES_MEDIA_TRANSITIONS: Record<
	ValentinaMemoriesMediaStatus,
	readonly ValentinaMemoriesMediaStatus[]
> = {
	uploading: ['validating', 'deleted'],
	validating: ['accepted', 'rejected', 'deleted', 'duplicate'],
	accepted: ['rejected', 'deleted'],
	rejected: ['deleted'],
	duplicate: ['deleted'],
	deleted: [],
};

export type ValentinaMemoriesMediaActor = 'guest' | 'organizer' | 'system';

export interface ValentinaMemoriesMediaItem {
	id: string;
	eventKey: typeof VALENTINA_MEMORIES_EVENT_ID;
	sessionId: string;
	objectKey: string;
	mimeType: keyof typeof VALENTINA_MEMORIES_ALLOWED_MIME_TYPES;
	sizeBytes: number;
	checksumSha256: string;
	durationSeconds: number | null;
	caption: string;
	status: ValentinaMemoriesMediaStatus;
	duplicateOfId: string | null;
	createdAt: string;
	updatedAt: string;
	acceptedAt: string | null;
	rejectedAt: string | null;
	deletedAt: string | null;
}

export interface ValentinaMemoriesMediaPublicItem {
	id: string;
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

export interface ValentinaMemoriesOrganizerItem extends ValentinaMemoriesMediaPublicItem {
	uploader: {
		displayName: string;
		guestAlias: string;
	};
}

export interface ValentinaMemoriesGuestProfile {
	displayName: string;
	guestAlias: string;
	expiresAt: string;
}

export function isValidSha256Hex(value: unknown): value is string {
	return typeof value === 'string' && VALENTINA_MEMORIES_SHA256_HEX_PATTERN.test(value);
}

export function canTransitionValentinaMemoriesMedia(
	from: ValentinaMemoriesMediaStatus,
	to: ValentinaMemoriesMediaStatus,
): boolean {
	return VALENTINA_MEMORIES_MEDIA_TRANSITIONS[from]?.includes(to) ?? false;
}

export function sanitizeValentinaMemoriesCaption(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, VALENTINA_MEMORIES_MAX_CAPTION_LENGTH);
}

export function sanitizeValentinaMemoriesDisplayName(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH);
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

function isJpegSignature(bytes: Uint8Array): boolean {
	return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPngSignature(bytes: Uint8Array): boolean {
	return (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}

function isWebpSignature(bytes: Uint8Array): boolean {
	const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
	const isWebp =
		bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
	return isRiff && isWebp;
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'];

function isIsoBmffSignature(bytes: Uint8Array, normalizedMime: string): boolean {
	const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
	if (boxType === 'ftyp' || boxType === 'moov') {
		if (normalizedMime === 'image/heic' || normalizedMime === 'image/heif') {
			const brand = String.fromCharCode(
				bytes[8],
				bytes[9],
				bytes[10],
				bytes[11],
			).toLowerCase();
			return HEIC_BRANDS.some((b) => brand.startsWith(b));
		}
		return true;
	}
	if (normalizedMime === 'video/quicktime') {
		return boxType === 'wide' || boxType === 'free' || boxType === 'mdat';
	}
	return false;
}

/**
 * Inspects a bounded byte buffer (e.g. initial 32–64 bytes) to ensure magic bytes
 * match the declared allowlisted MIME type.
 */
export function isValentinaMemoriesSignatureValid(bytes: Uint8Array, mimeType: string): boolean {
	const normalized = mimeType.trim().toLowerCase();
	if (bytes.length < 12) return false;

	if (normalized === 'image/jpeg') return isJpegSignature(bytes);
	if (normalized === 'image/png') return isPngSignature(bytes);
	if (normalized === 'image/webp') return isWebpSignature(bytes);

	if (
		normalized === 'image/heic' ||
		normalized === 'image/heif' ||
		normalized === 'video/mp4' ||
		normalized === 'video/quicktime'
	) {
		return isIsoBmffSignature(bytes, normalized);
	}

	return false;
}

/**
 * Extracts video duration from a bounded ISO BMFF / MP4 container header buffer.
 * Returns duration in seconds, or null if container header is incomplete/invalid.
 */
function parseMoovDuration(bytes: Uint8Array, moovOffset: number): number | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const moovLength = view.getUint32(moovOffset);
	if (moovLength < 8) return null;
	const moovEnd = Math.min(moovOffset + moovLength, bytes.length);

	for (let offset = moovOffset + 8; offset + 8 <= moovEnd;) {
		const boxLength = view.getUint32(offset);
		const boxType = String.fromCharCode(
			bytes[offset + 4],
			bytes[offset + 5],
			bytes[offset + 6],
			bytes[offset + 7],
		);
		if (boxLength < 8) return null;

		if (boxType === 'mvhd') {
			const version = view.getUint8(offset + 8);
			if (version === 0 && offset + 28 <= moovEnd) {
				const timescale = view.getUint32(offset + 20);
				const duration = view.getUint32(offset + 24);
				return timescale > 0 ? duration / timescale : null;
			}
			if (version === 1 && offset + 40 <= moovEnd) {
				const timescale = view.getUint32(offset + 28);
				const duration =
					view.getUint32(offset + 32) * 4294967296 + view.getUint32(offset + 36);
				return timescale > 0 ? duration / timescale : null;
			}
			return null;
		}

		offset += boxLength;
	}
	return null;
}

export function parseBoundedVideoDurationSeconds(bytes: Uint8Array): number | null {
	if (bytes.length < 32) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	for (let offset = 0; offset + 8 <= bytes.length;) {
		const boxLength = view.getUint32(offset);
		if (boxLength < 8) break;
		if (
			bytes[offset + 4] === 0x6d &&
			bytes[offset + 5] === 0x6f &&
			bytes[offset + 6] === 0x6f &&
			bytes[offset + 7] === 0x76
		) {
			return parseMoovDuration(bytes, offset);
		}
		offset += boxLength;
	}

	// A tail range can begin in the middle of a preceding atom. Recover a complete
	// `moov` atom inside that bounded range without trusting the partial prefix.
	for (let typeOffset = 4; typeOffset + 4 <= bytes.length; typeOffset += 1) {
		if (
			bytes[typeOffset] === 0x6d &&
			bytes[typeOffset + 1] === 0x6f &&
			bytes[typeOffset + 2] === 0x6f &&
			bytes[typeOffset + 3] === 0x76
		) {
			const duration = parseMoovDuration(bytes, typeOffset - 4);
			if (duration !== null) return duration;
		}
	}
	return null;
}
