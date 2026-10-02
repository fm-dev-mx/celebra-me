/**
 * Illustrative capacity of a memory space, so an administrator can read a quota
 * as photos, videos and guests. The reference sizes are planning assumptions,
 * not measurements; the reservation RPC stays the only enforced boundary.
 * This module must stay free of imports beyond sibling contract files.
 */

import type { MemoriesSpaceLimits } from './limits';
import { MEMORIES_MAX_VIDEO_BYTES } from './media-policy';

export const MEMORIES_CAPACITY_REFERENCE = {
	/** A phone photo after the browser resizes it to the optimization bound. */
	photoBytes: 2_000_000,
	/** A phone clip of roughly 30 seconds at 1080p. */
	videoBytes: 40_000_000,
	/** Mixed album: photos shared per video. */
	photosPerVideo: 10,
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
