/**
 * Illustrative capacity of a memory space, so an administrator can read a quota
 * as photos, videos and guests. The reference sizes are planning assumptions,
 * not measurements; the reservation RPC stays the only enforced boundary.
 * This module must stay free of imports beyond sibling contract files.
 */

import type { MemoriesWindowState } from './catalog';
import type { MemoriesSpaceLimits } from './limits';
import { MEMORIES_MAX_VIDEO_BYTES } from './media-policy';

export const MEMORIES_CAPACITY_REFERENCE = {
	/** A phone photo after the browser resizes it to the optimization bound. */
	photoBytes: 2_000_000,
	/** A phone clip of roughly 30 seconds at 1080p. */
	videoBytes: 40_000_000,
	/** Mixed album: photos shared per video. */
	photosPerVideo: 10,
	/** What a typical participating guest shares. */
	typicalGuestPhotos: 5,
	typicalGuestVideos: 1,
} as const;

export interface MemoriesCapacityEstimate {
	photosOnly: number;
	/** True when the file count, not the storage, is what stops a photo-only album. */
	photosBoundByFiles: boolean;
	videosOnly: number;
	/** Every video at the maximum size the upload policy accepts. */
	videosAtMaxSize: number;
	mixPhotos: number;
	mixVideos: number;
	/** Photos and videos one guest shares when using the whole per-guest allowance. */
	guestPhotos: number;
	guestVideos: number;
	/** Guests that fit if each one uses that whole allowance. */
	guestsAtFullAllowance: number;
}

export interface MemoriesGuestFit {
	filesPerGuest: number;
	bytesPerGuest: number;
	/** Guests the quota holds if each shares the typical amount. */
	typicalGuestsSupported: number;
	/** True when every expected guest sharing the typical amount would not fit. */
	shortForTypicalUse: boolean;
}

function wholeUnits(total: number, unit: number): number {
	return unit > 0 && total > 0 ? Math.floor(total / unit) : 0;
}

export function estimateMemoriesCapacity(limits: MemoriesSpaceLimits): MemoriesCapacityEstimate {
	const { photoBytes, videoBytes, photosPerVideo } = MEMORIES_CAPACITY_REFERENCE;
	const files = Math.max(0, limits.maxEventObjects);
	const bytes = Math.max(0, limits.maxEventBytes);

	const photosByStorage = wholeUnits(bytes, photoBytes);
	const mixUnits = Math.min(
		wholeUnits(bytes, photosPerVideo * photoBytes + videoBytes),
		wholeUnits(files, photosPerVideo + 1),
	);

	const guestVideos = Math.max(0, Math.min(limits.maxSessionVideos, limits.maxSessionFiles));
	const guestPhotos = Math.max(0, limits.maxSessionFiles - guestVideos);
	const guestBytes = Math.min(
		Math.max(0, limits.maxSessionBytes),
		guestVideos * videoBytes + guestPhotos * photoBytes,
	);

	return {
		photosOnly: Math.min(files, photosByStorage),
		photosBoundByFiles: files < photosByStorage,
		videosOnly: Math.min(files, wholeUnits(bytes, videoBytes)),
		videosAtMaxSize: Math.min(files, wholeUnits(bytes, MEMORIES_MAX_VIDEO_BYTES)),
		mixPhotos: mixUnits * photosPerVideo,
		mixVideos: mixUnits,
		guestPhotos,
		guestVideos,
		guestsAtFullAllowance: Math.min(
			wholeUnits(files, limits.maxSessionFiles),
			wholeUnits(bytes, guestBytes),
		),
	};
}

/** Reads a quota against the expected attendance. Null without a usable guest count. */
export function estimateMemoriesGuestFit(
	limits: Pick<MemoriesSpaceLimits, 'maxEventObjects' | 'maxEventBytes'>,
	expectedGuests: number | null,
): MemoriesGuestFit | null {
	if (expectedGuests === null || !Number.isInteger(expectedGuests) || expectedGuests <= 0) {
		return null;
	}
	const { photoBytes, videoBytes, typicalGuestPhotos, typicalGuestVideos } =
		MEMORIES_CAPACITY_REFERENCE;
	const typicalFiles = typicalGuestPhotos + typicalGuestVideos;
	const typicalBytes = typicalGuestPhotos * photoBytes + typicalGuestVideos * videoBytes;
	const typicalGuestsSupported = Math.min(
		wholeUnits(limits.maxEventObjects, typicalFiles),
		wholeUnits(limits.maxEventBytes, typicalBytes),
	);
	return {
		filesPerGuest: wholeUnits(limits.maxEventObjects, expectedGuests),
		bytesPerGuest: wholeUnits(limits.maxEventBytes, expectedGuests),
		typicalGuestsSupported,
		shortForTypicalUse: typicalGuestsSupported < expectedGuests,
	};
}

/**
 * Storage a space commits against the shared allowance: its whole quota while it
 * can still receive uploads, otherwise only what it already stores.
 */
export function committedMemoriesBytes(
	windowState: MemoriesWindowState,
	maxEventBytes: number,
	residentBytes: number,
): number {
	const live = windowState === 'before' || windowState === 'open';
	return live ? Math.max(maxEventBytes, residentBytes) : residentBytes;
}
