import {
	committedMemoriesBytes,
	estimateMemoriesCapacity,
	estimateMemoriesGuestFit,
} from '@/lib/memories/contract/capacity';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';

describe('estimateMemoriesCapacity', () => {
	it('reads the standard profile as photos, videos and guests', () => {
		expect(estimateMemoriesCapacity(MEMORIES_LIMIT_PROFILES.standard)).toEqual({
			// 5 GB would hold 2,500 reference photos; the 1,500-file limit stops it first.
			photosOnly: 1_500,
			photosBoundByFiles: true,
			videosOnly: 125,
			videosAtMaxSize: 59,
			mixPhotos: 830,
			mixVideos: 83,
			guestPhotos: 12,
			guestVideos: 3,
			// 3 videos + 12 photos ≈ 144 MB per guest: storage, not files, is the bound.
			guestsAtFullAllowance: 34,
		});
	});

	it('doubles with the extended profile except where a per-guest allowance grows too', () => {
		const estimate = estimateMemoriesCapacity(MEMORIES_LIMIT_PROFILES.extended);
		expect(estimate).toMatchObject({
			photosOnly: 3_000,
			videosOnly: 250,
			mixVideos: 166,
			guestPhotos: 24,
			guestVideos: 6,
			guestsAtFullAllowance: 34,
		});
	});

	it('caps a guest at the per-guest storage and never divides by zero', () => {
		expect(
			estimateMemoriesCapacity({
				maxEventObjects: 100,
				maxEventBytes: 1_000_000_000,
				maxSessionFiles: 20,
				maxSessionVideos: 20,
				maxSessionBytes: 100_000_000,
			}),
		).toMatchObject({ guestPhotos: 0, guestVideos: 20, guestsAtFullAllowance: 5 });
		expect(
			estimateMemoriesCapacity({
				maxEventObjects: 0,
				maxEventBytes: 0,
				maxSessionFiles: 0,
				maxSessionVideos: 0,
				maxSessionBytes: 0,
			}),
		).toMatchObject({ photosOnly: 0, videosOnly: 0, mixVideos: 0, guestsAtFullAllowance: 0 });
	});
});

describe('estimateMemoriesGuestFit', () => {
	it('flags a quota that is short for the expected attendance at typical use', () => {
		// Typical guest: 5 photos + 1 video ≈ 50 MB, so 5 GB holds about 100 of them.
		expect(estimateMemoriesGuestFit(MEMORIES_LIMIT_PROFILES.standard, 150)).toEqual({
			filesPerGuest: 10,
			bytesPerGuest: 33_333_333,
			typicalGuestsSupported: 100,
			shortForTypicalUse: true,
		});
	});

	it('accepts an attendance the quota covers', () => {
		expect(estimateMemoriesGuestFit(MEMORIES_LIMIT_PROFILES.standard, 80)).toMatchObject({
			typicalGuestsSupported: 100,
			shortForTypicalUse: false,
		});
	});

	it('returns nothing without a usable guest count', () => {
		expect(estimateMemoriesGuestFit(MEMORIES_LIMIT_PROFILES.standard, null)).toBeNull();
		expect(estimateMemoriesGuestFit(MEMORIES_LIMIT_PROFILES.standard, 0)).toBeNull();
		expect(estimateMemoriesGuestFit(MEMORIES_LIMIT_PROFILES.standard, 12.5)).toBeNull();
	});
});

describe('committedMemoriesBytes', () => {
	it('commits the whole quota only while the space can still receive uploads', () => {
		expect(committedMemoriesBytes('before', 5_000, 0)).toBe(5_000);
		expect(committedMemoriesBytes('open', 5_000, 1_200)).toBe(5_000);
		expect(committedMemoriesBytes('open', 5_000, 6_000)).toBe(6_000);
		expect(committedMemoriesBytes('closed', 5_000, 1_200)).toBe(1_200);
		expect(committedMemoriesBytes('disabled', 5_000, 1_200)).toBe(1_200);
		expect(committedMemoriesBytes('expired', 5_000, 0)).toBe(0);
	});
});
