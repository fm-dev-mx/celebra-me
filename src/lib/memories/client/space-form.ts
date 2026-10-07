/**
 * State of the administrator's space form and the pure rules around it, kept out
 * of the components so the modal, its fieldsets and the console share one shape.
 */

import type { AdminSpaceCandidate } from '@/lib/memories/client/api';
import type { MemoriesAdminSpaceItem } from '@/lib/memories/contract/catalog';
import {
	MEMORIES_LIMIT_PROFILES,
	type MemoriesEntitlement,
	type MemoriesLimitProfile,
	type MemoriesSpaceLimits,
} from '@/lib/memories/contract/limits';

export type MemorySpaceFormState = {
	eventId: string;
	eventTitle: string;
	publicSlug: string;
	timeZone: string;
	uploadStartsLocal: string;
	uploadEndsLocal: string;
	retentionEndsLocal: string;
	entitlement: MemoriesEntitlement;
	limits: MemoriesSpaceLimits;
	eventDate: string | null;
	expectedGuests: number | null;
	adminNote: string;
};

/**
 * What the rest of the account already commits against the R2 allowance, and this
 * space's own share, so the form can show the total the save would leave.
 */
export type MemorySpaceCommitment = {
	otherBytes: number;
	ownResidentBytes: number;
	/** False for a space that can no longer receive uploads: it only holds what it stores. */
	ownLive: boolean;
};

/** Zones used by current clients; any other stored zone is kept as an extra option. */
export const MEMORIES_COMMON_TIME_ZONES = [
	'America/Mexico_City',
	'America/Mazatlan',
	'America/Tijuana',
	'America/Hermosillo',
	'America/Chihuahua',
	'America/Monterrey',
	'America/Cancun',
];

export function formFromCandidate(candidate: AdminSpaceCandidate): MemorySpaceFormState {
	return {
		eventId: candidate.eventId,
		eventTitle: candidate.eventTitle,
		publicSlug: candidate.defaults.publicSlug,
		timeZone: candidate.defaults.timeZone,
		uploadStartsLocal: candidate.defaults.uploadStartsLocal,
		uploadEndsLocal: candidate.defaults.uploadEndsLocal,
		retentionEndsLocal: candidate.defaults.retentionEndsLocal,
		entitlement: 'addon',
		limits: { ...candidate.defaults.limits },
		eventDate: candidate.eventDate,
		expectedGuests: null,
		adminNote: '',
	};
}

function toLocalInput(iso: string, timeZone: string): string {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		}).formatToParts(new Date(iso));
		const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '00';
		return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
	} catch {
		return iso.slice(0, 16);
	}
}

export function formFromSpace(space: MemoriesAdminSpaceItem): MemorySpaceFormState {
	return {
		eventId: space.eventId,
		eventTitle: space.eventTitle,
		publicSlug: space.publicSlug,
		timeZone: space.timeZone,
		uploadStartsLocal: toLocalInput(space.uploadStartsAt, space.timeZone),
		uploadEndsLocal: toLocalInput(space.uploadEndsAt, space.timeZone),
		retentionEndsLocal: toLocalInput(space.retentionEndsAt, space.timeZone),
		entitlement: space.entitlement,
		limits: {
			maxEventObjects: space.maxEventObjects,
			maxEventBytes: space.maxEventBytes,
			maxSessionFiles: space.maxSessionFiles,
			maxSessionVideos: space.maxSessionVideos,
			maxSessionBytes: space.maxSessionBytes,
		},
		eventDate: space.eventDate,
		expectedGuests: space.expectedGuests,
		adminNote: space.adminNote ?? '',
	};
}

export function matchMemoriesLimitProfile(
	limits: MemoriesSpaceLimits,
): MemoriesLimitProfile | 'custom' {
	const entries = Object.entries(MEMORIES_LIMIT_PROFILES) as Array<
		[MemoriesLimitProfile, MemoriesSpaceLimits]
	>;
	const match = entries.find(([, preset]) =>
		(Object.keys(preset) as Array<keyof MemoriesSpaceLimits>).every(
			(key) => preset[key] === limits[key],
		),
	);
	return match ? match[0] : 'custom';
}

/** Storage committed account-wide if the space is saved with this event quota. */
export function projectMemoriesCommitment(
	commitment: MemorySpaceCommitment,
	maxEventBytes: number,
): number {
	const own = commitment.ownLive
		? Math.max(maxEventBytes, commitment.ownResidentBytes)
		: commitment.ownResidentBytes;
	return commitment.otherBytes + own;
}
