jest.mock('@/lib/memories/server/catalog.repository', () => ({
	listResidentMediaUsage: jest.fn(),
	listSessionEventIds: jest.fn(),
}));

import {
	listResidentMediaUsage,
	listSessionEventIds,
	type MediaUsageRow,
} from '@/lib/memories/server/catalog.repository';
import {
	getMemorySpaceHostSummary,
	listMemorySpacesWithUsage,
	summarizeMemorySpaceUsage,
} from '@/lib/memories/server/usage.service';
import { EVENT_ID, NOW, OTHER_SESSION_ID, SESSION_ID, buildSpace } from './fixtures';

const mockResident = listResidentMediaUsage as jest.MockedFunction<typeof listResidentMediaUsage>;
const mockSessions = listSessionEventIds as jest.MockedFunction<typeof listSessionEventIds>;

const OTHER_EVENT_ID = 'e0000000-0000-4000-8000-0000000000c2';

function row(overrides: Partial<MediaUsageRow>): MediaUsageRow {
	return {
		id: `item-${Math.random()}`,
		event_id: EVENT_ID,
		session_id: SESSION_ID,
		status: 'accepted',
		mime_type: 'image/jpeg',
		size_bytes: 1_000,
		accepted_at: '2026-10-24T11:00:00.000Z',
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockSessions.mockResolvedValue([EVENT_ID, EVENT_ID, EVENT_ID]);
	mockResident.mockResolvedValue([
		row({ size_bytes: 3_000 }),
		row({ mime_type: 'video/mp4', accepted_at: '2026-10-25T09:00:00.000Z' }),
		row({ session_id: OTHER_SESSION_ID, mime_type: 'video/quicktime' }),
		row({ status: 'uploading', accepted_at: null }),
		row({ status: 'validating', accepted_at: null }),
		row({ status: 'rejected', accepted_at: null, session_id: 'rejected-only' }),
		// Logically deleted but still in R2: counts toward the quota, not toward totals.
		row({ status: 'deleted', accepted_at: null }),
	]);
});

describe('summarizeMemorySpaceUsage', () => {
	it('aggregates resident rows the same way the reservation quota counts them', async () => {
		const usage = await summarizeMemorySpaceUsage([EVENT_ID]);

		expect(mockResident).toHaveBeenCalledWith([EVENT_ID]);
		expect(usage.get(EVENT_ID)).toEqual({
			photos: 1,
			videos: 2,
			guestsWithUploads: 2,
			sessions: 3,
			residentObjects: 7,
			residentBytes: 9_000,
			inFlight: 2,
			rejected: 1,
			lastAcceptedAt: '2026-10-25T09:00:00.000Z',
		});
	});

	it('returns zeroed usage for spaces without rows and ignores unrelated events', async () => {
		mockResident.mockResolvedValue([row({ event_id: 'not-requested' })]);
		mockSessions.mockResolvedValue([]);

		const usage = await summarizeMemorySpaceUsage([OTHER_EVENT_ID]);

		expect(usage.get(OTHER_EVENT_ID)).toMatchObject({
			photos: 0,
			residentBytes: 0,
			lastAcceptedAt: null,
		});
		expect(usage.has('not-requested')).toBe(false);
	});
});

describe('listMemorySpacesWithUsage', () => {
	it('commits the full quota only for spaces that can still receive uploads', async () => {
		const open = buildSpace();
		const paused = buildSpace({ eventId: OTHER_EVENT_ID, enabled: false });
		mockResident.mockResolvedValue([row({ event_id: OTHER_EVENT_ID, size_bytes: 5_000 })]);
		mockSessions.mockResolvedValue([]);

		const { items, totals } = await listMemorySpacesWithUsage([open, paused], NOW);

		expect(items.map((item) => item.usage.residentBytes)).toEqual([0, 5_000]);
		expect(totals).toEqual({
			residentBytes: 5_000,
			committedBytes: open.maxEventBytes + 5_000,
		});
	});

	it('never exposes session ids or guest identity in the admin projection', async () => {
		const { items } = await listMemorySpacesWithUsage([buildSpace()], NOW);
		const serialized = JSON.stringify(items);

		expect(serialized).not.toContain(SESSION_ID);
		expect(Object.keys(items[0].usage).sort()).toEqual(
			[
				'guestsWithUploads',
				'inFlight',
				'lastAcceptedAt',
				'photos',
				'rejected',
				'residentBytes',
				'residentObjects',
				'sessions',
				'videos',
			].sort(),
		);
	});
});

describe('getMemorySpaceHostSummary', () => {
	it('reports the tighter of the byte and file quotas as remaining capacity', async () => {
		const space = buildSpace({ maxEventObjects: 10, maxEventBytes: 1_000_000 });

		const summary = await getMemorySpaceHostSummary(space, NOW);

		expect(summary).toMatchObject({
			windowState: 'open',
			photos: 1,
			videos: 2,
			guestsWithUploads: 2,
			publicUrl: 'https://celebra-me.com/r/victoria-y-roberto',
			capacityRemainingPercent: 30,
		});
		expect(summary).not.toHaveProperty('rejected');
		expect(summary).not.toHaveProperty('maxEventBytes');
		expect(summary).not.toHaveProperty('entitlement');
	});
});
