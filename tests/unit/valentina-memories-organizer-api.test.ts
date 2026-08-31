jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireDashboardSessionFromLocals: jest.fn(),
}));

jest.mock('@/lib/memories/valentina-memories.service', () => ({
	assertValentinaOrganizerAccess: jest.fn(),
	listOrganizerMemoryItems: jest.fn(),
	revokeGuestMemorySession: jest.fn(),
}));

import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import {
	assertValentinaOrganizerAccess,
	listOrganizerMemoryItems,
} from '@/lib/memories/valentina-memories.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { GET } from '@/pages/api/dashboard/memories/valentina';

const mockSession = requireDashboardSessionFromLocals as jest.MockedFunction<
	typeof requireDashboardSessionFromLocals
>;
const mockAccess = assertValentinaOrganizerAccess as jest.MockedFunction<
	typeof assertValentinaOrganizerAccess
>;
const mockList = listOrganizerMemoryItems as jest.MockedFunction<typeof listOrganizerMemoryItems>;

function context(url: string) {
	const request = new Request(url);
	return { request, url: new URL(url), locals: {} } as never;
}

describe('GET /api/dashboard/memories/valentina', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSession.mockReturnValue({ userId: 'owner-id', accessToken: 'owner-token' } as never);
		mockAccess.mockResolvedValue();
		mockList.mockResolvedValue({ items: [], nextPage: null });
	});

	it('keeps owner authorization and forwards validated private catalog filters', async () => {
		const response = await GET(
			context(
				'https://celebra.test/api/dashboard/memories/valentina?page=2&status=accepted&uploader=T%C3%ADa+Ana&createdFrom=2026-08-29T06%3A00%3A00.000Z&createdTo=2026-08-30T06%3A00%3A00.000Z',
			),
		);
		expect(response.status).toBe(200);
		expect(mockAccess).toHaveBeenCalledWith({ accessToken: 'owner-token' });
		expect(mockList).toHaveBeenCalledWith({
			page: 2,
			status: 'accepted',
			uploader: 'Tía Ana',
			createdFrom: '2026-08-29T06:00:00.000Z',
			createdTo: '2026-08-30T06:00:00.000Z',
		});
		expect(response.headers.get('cache-control')).toContain('private');
	});

	it('rejects invalid status before querying the catalog', async () => {
		const response = await GET(
			context('https://celebra.test/api/dashboard/memories/valentina?status=private-key'),
		);
		expect(response.status).toBe(400);
		expect(mockList).not.toHaveBeenCalled();
	});

	it('returns forbidden when owner access fails', async () => {
		mockAccess.mockRejectedValue(new ApiError(403, 'forbidden', 'No autorizado.'));
		const response = await GET(
			context('https://celebra.test/api/dashboard/memories/valentina?page=0'),
		);
		expect(response.status).toBe(403);
		expect(mockList).not.toHaveBeenCalled();
	});
});
