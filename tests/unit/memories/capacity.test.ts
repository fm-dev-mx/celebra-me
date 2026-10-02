import { estimateMemoriesCapacity } from '@/lib/memories/contract/capacity';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';

describe('estimateMemoriesCapacity', () => {
	it('reads the standard profile as photos, videos and guests', () => {
		expect(estimateMemoriesCapacity(MEMORIES_LIMIT_PROFILES.standard)).toEqual({
			// 8 GB would hold 4,000 reference photos; the 2,000-file limit stops it first.
			photosOnly: 2_000,
			photosBoundByFiles: true,
			videosOnly: 200,
			videosAtMaxSize: 95,
			mixPhotos: 1_330,
			mixVideos: 133,
			guestPhotos: 15,
			guestVideos: 5,
			// 5 videos + 15 photos ≈ 230 MB per guest: storage, not files, is the bound.
			guestsAtFullAllowance: 34,
		});
	});

	it('doubles with the extended profile except where a per-guest allowance grows too', () => {
		const estimate = estimateMemoriesCapacity(MEMORIES_LIMIT_PROFILES.extended);
		expect(estimate).toMatchObject({
			photosOnly: 4_000,
			videosOnly: 400,
			mixVideos: 266,
			guestPhotos: 30,
			guestVideos: 10,
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
