/**
 * Catalog semantics shared by the app and the browser islands: media statuses,
 * transitions, sanitizers and the DTO shapes exchanged with the API.
 * This module must stay free of imports beyond sibling contract files so Wrangler can bundle it by relative path.
 */

import {
	MEMORIES_DISPLAY_NAME_MAX_LENGTH,
	MEMORIES_MAX_CAPTION_LENGTH,
	type MemoriesEntitlement,
	type MemoriesSpaceLimits,
} from './limits';
import type { MemoriesAllowedMimeType } from './media-policy';

export const MEMORIES_MEDIA_STATUSES = [
	'uploading',
	'validating',
	'accepted',
	'rejected',
	'deleted',
	'duplicate',
] as const;
export type MemoriesMediaStatus = (typeof MEMORIES_MEDIA_STATUSES)[number];

const MEMORIES_MEDIA_TRANSITIONS: Record<MemoriesMediaStatus, readonly MemoriesMediaStatus[]> = {
	uploading: ['validating', 'deleted'],
	validating: ['accepted', 'rejected', 'deleted', 'duplicate'],
	accepted: ['rejected', 'deleted'],
	rejected: ['deleted'],
	duplicate: ['deleted'],
	deleted: [],
};

export const MEMORIES_TERMINAL_STATUSES: readonly MemoriesMediaStatus[] = [
	'accepted',
	'duplicate',
	'rejected',
	'deleted',
];

export type MemoriesMediaActor = 'guest' | 'organizer' | 'admin' | 'system';

/**
 * Why a reservation was refused, sent as `error.details.reason`. Several causes
 * share one HTTP code; the guest copy needs the cause to say what to do next.
 */
export const MEMORIES_RESERVATION_REFUSALS = [
	'session_files',
	'session_videos',
	'session_bytes',
	'event_capacity',
	'uploads_in_progress',
] as const;
export type MemoriesReservationRefusal = (typeof MEMORIES_RESERVATION_REFUSALS)[number];

export function isMemoriesMediaStatus(value: unknown): value is MemoriesMediaStatus {
	return (
		typeof value === 'string' && (MEMORIES_MEDIA_STATUSES as readonly string[]).includes(value)
	);
}

export function isMemoriesCatalogVisibleStatus(status: MemoriesMediaStatus): boolean {
	return status !== 'deleted';
}

export function isMemoriesTerminalStatus(status: MemoriesMediaStatus): boolean {
	return MEMORIES_TERMINAL_STATUSES.includes(status);
}

export function canTransitionMemoriesMedia(
	from: MemoriesMediaStatus,
	to: MemoriesMediaStatus,
): boolean {
	return MEMORIES_MEDIA_TRANSITIONS[from]?.includes(to) ?? false;
}

export const MEMORIES_SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
export const MEMORIES_UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSha256Hex(value: unknown): value is string {
	return typeof value === 'string' && MEMORIES_SHA256_HEX_PATTERN.test(value);
}

export function isMemoriesUuid(value: unknown): value is string {
	return typeof value === 'string' && MEMORIES_UUID_PATTERN.test(value);
}

/** Recovery code: three groups of four unambiguous characters. */
export const MEMORIES_RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MEMORIES_RECOVERY_CODE_GROUPS = 3;
export const MEMORIES_RECOVERY_CODE_GROUP_LENGTH = 4;
export const MEMORIES_RECOVERY_CODE_LENGTH =
	MEMORIES_RECOVERY_CODE_GROUPS * MEMORIES_RECOVERY_CODE_GROUP_LENGTH +
	(MEMORIES_RECOVERY_CODE_GROUPS - 1);
export const MEMORIES_RECOVERY_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){2}$/;

export function formatMemoriesCodeGroups(raw: string, groups: number): string {
	const parts: string[] = [];
	for (let index = 0; index < groups; index += 1) {
		parts.push(
			raw.slice(
				index * MEMORIES_RECOVERY_CODE_GROUP_LENGTH,
				(index + 1) * MEMORIES_RECOVERY_CODE_GROUP_LENGTH,
			),
		);
	}
	return parts.join('-');
}

export const MEMORIES_GUEST_ALIAS_PATTERN = /^invitado-[a-z0-9]{8}$/;

export function sanitizeMemoriesCaption(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, MEMORIES_MAX_CAPTION_LENGTH);
}

export function sanitizeMemoriesDisplayName(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, MEMORIES_DISPLAY_NAME_MAX_LENGTH);
}

/** Server-internal catalog row projection. Never sent to a browser as-is. */
export interface MemoriesMediaItem {
	id: string;
	eventId: string;
	sessionId: string;
	objectKey: string;
	mimeType: MemoriesAllowedMimeType;
	sizeBytes: number;
	checksumSha256: string;
	durationSeconds: number | null;
	caption: string;
	status: MemoriesMediaStatus;
	duplicateOfId: string | null;
	createdAt: string;
	updatedAt: string;
	acceptedAt: string | null;
	rejectedAt: string | null;
	deletedAt: string | null;
}

/** Browser-facing projection: no keys, no session, no checksum. */
export interface MemoriesMediaPublicItem {
	id: string;
	mimeType: MemoriesAllowedMimeType;
	sizeBytes: number;
	durationSeconds: number | null;
	caption: string;
	status: MemoriesMediaStatus;
	createdAt: string;
	updatedAt: string;
	acceptedAt: string | null;
	rejectedAt: string | null;
	deletedAt: string | null;
}

export interface MemoriesOrganizerItem extends MemoriesMediaPublicItem {
	uploader: {
		displayName: string;
		guestAlias: string;
	};
}

export interface MemoriesOrganizerListQuery {
	page?: number;
	status?: MemoriesMediaStatus;
	uploader?: string;
	createdFrom?: string;
	createdTo?: string;
}

export interface MemoriesOrganizerListResponse {
	items: MemoriesOrganizerItem[];
	nextPage: number | null;
}

export interface MemoriesGuestProfile {
	displayName: string;
	expiresAt: string;
}

export interface MemoriesQuotaCounter {
	used: number;
	remaining: number;
	limit: number;
}

export interface MemoriesGuestQuota {
	files: MemoriesQuotaCounter;
	videos: MemoriesQuotaCounter;
	bytes: MemoriesQuotaCounter;
	inFlight: MemoriesQuotaCounter;
}

export type MemoriesWindowState = 'disabled' | 'before' | 'open' | 'closed' | 'expired';

/** Public projection of an event memory space, safe for the guest page. */
export interface MemoriesSpaceSummary {
	publicSlug: string;
	eventTitle: string;
	timeZone: string;
	uploadStartsAt: string;
	uploadEndsAt: string;
	retentionEndsAt: string;
	windowState: MemoriesWindowState;
}

/** Administrator projection of an event memory space. */
export interface MemoriesSpaceRecord extends MemoriesSpaceLimits {
	eventId: string;
	eventSlug: string;
	eventTitle: string;
	publicSlug: string;
	enabled: boolean;
	timeZone: string;
	uploadStartsAt: string;
	uploadEndsAt: string;
	retentionEndsAt: string;
	entitlement: MemoriesEntitlement;
	/** Planning input for capacity estimates. Administrator-only. */
	expectedGuests: number | null;
	/** Free-text internal note. Administrator-only; never audited or sent to hosts. */
	adminNote: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Aggregate usage of one space for the super-admin console. Counts and bytes
 * only: never guest names, aliases, object keys or captions.
 */
export interface MemoriesSpaceAdminUsage {
	photos: number;
	videos: number;
	guestsWithUploads: number;
	sessions: number;
	residentObjects: number;
	residentBytes: number;
	inFlight: number;
	rejected: number;
	lastAcceptedAt: string | null;
}

export interface MemoriesAdminSpaceItem extends MemoriesSpaceRecord {
	usage: MemoriesSpaceAdminUsage;
	/** Local event date from the published invitation, when readable. */
	eventDate: string | null;
	/** Latest file download by a host; proves a download happened, not that it was complete. */
	lastHostDownloadAt: string | null;
}

export interface MemoriesAdminTotals {
	/** Bytes the database tracks as resident in R2 across every space. */
	residentBytes: number;
	/** Bytes live spaces may still reach: quota while enabled, resident bytes otherwise. */
	committedBytes: number;
}

/** Host projection: progress without limits, commercial origin or diagnostics. */
export interface MemoriesSpaceHostSummary extends MemoriesSpaceSummary {
	publicUrl: string;
	photos: number;
	videos: number;
	guestsWithUploads: number;
	lastAcceptedAt: string | null;
	/** 0–100, the tighter of the byte and file quotas. */
	capacityRemainingPercent: number;
}

/**
 * Whole days until retention ends while the deletion warning applies, else null.
 * Shared by both dashboards so the countdown reads the same for admin and host.
 */
export function resolveMemoriesRetentionWarningDays(
	space: { retentionEndsAt: string },
	now: Date,
	warningDays: number,
): number | null {
	const remainingMs = Date.parse(space.retentionEndsAt) - now.getTime();
	if (!(remainingMs > 0)) return null;
	const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
	return days <= warningDays ? days : null;
}

export function resolveMemoriesWindowState(
	space: {
		enabled: boolean;
		uploadStartsAt: string;
		uploadEndsAt: string;
		retentionEndsAt: string;
	},
	now: Date,
): MemoriesWindowState {
	const timestamp = now.getTime();
	if (timestamp >= Date.parse(space.retentionEndsAt)) return 'expired';
	if (!space.enabled) return 'disabled';
	if (timestamp < Date.parse(space.uploadStartsAt)) return 'before';
	if (timestamp < Date.parse(space.uploadEndsAt)) return 'open';
	return 'closed';
}

export function calculateMemoriesGuestQuota(
	rows: readonly {
		mimeType: string;
		sizeBytes: number;
		status: MemoriesMediaStatus;
		objectDeleted: boolean;
	}[],
	limits: Pick<MemoriesSpaceLimits, 'maxSessionFiles' | 'maxSessionVideos' | 'maxSessionBytes'>,
	maxInFlight: number,
): MemoriesGuestQuota {
	const counter = (used: number, limit: number): MemoriesQuotaCounter => ({
		used,
		remaining: Math.max(0, limit - used),
		limit,
	});
	const resident = rows.filter((row) => !row.objectDeleted);
	const videos = resident.filter((row) => row.mimeType.startsWith('video/')).length;
	const bytes = resident.reduce((total, row) => total + Number(row.sizeBytes), 0);
	const inFlight = resident.filter(
		(row) => row.status === 'uploading' || row.status === 'validating',
	).length;
	return {
		files: counter(resident.length, limits.maxSessionFiles),
		videos: counter(videos, limits.maxSessionVideos),
		bytes: counter(bytes, limits.maxSessionBytes),
		inFlight: counter(inFlight, maxInFlight),
	};
}
