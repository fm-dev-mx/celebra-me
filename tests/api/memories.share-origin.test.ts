jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireDashboardMutationAccess: jest.fn(),
	requireDashboardSessionFromLocals: jest.fn(),
}));

jest.mock('@/lib/memories/server/organizer.service', () => ({
	requireOrganizerMemorySpace: jest.fn(),
}));

jest.mock('@/lib/memories/server/rate-limit', () => ({
	requireMemoriesRateLimit: jest.fn(),
}));

jest.mock('@/lib/memories/server/share.service', () => ({
	...jest.requireActual('@/lib/memories/server/share.service'),
	updateMemoriesShare: jest.fn(),
}));

jest.mock('@/lib/memories/server/usage.service', () => ({
	getMemorySpaceHostSummary: jest.fn(),
}));

import type { SessionContext } from '@/lib/rsvp/auth/auth';
import {
	requireDashboardMutationAccess,
	requireDashboardSessionFromLocals,
} from '@/lib/rsvp/auth/authorization';
import { requireOrganizerMemorySpace } from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { updateMemoriesShare } from '@/lib/memories/server/share.service';
import { getMemorySpaceHostSummary } from '@/lib/memories/server/usage.service';
import { POST as postShare } from '@/pages/api/dashboard/memories/[eventId]/share';
import { GET as getSummary } from '@/pages/api/dashboard/memories/[eventId]/summary';
import { createMockRequest } from '../helpers/api-mocks';
import { EVENT_ID, OWNER_USER_ID, buildSpace } from '../unit/memories/fixtures';

const PREVIEW_ORIGIN = 'https://celebra-me-git-develop.vercel.app';
const EVENT_URL = `${PREVIEW_ORIGIN}/api/dashboard/memories/${EVENT_ID}`;
const space = buildSpace();
const hostSession: SessionContext = {
	userId: OWNER_USER_ID,
	email: 'host@example.com',
	accessToken: 'host-access-token',
	role: 'host_client',
	isSuperAdmin: false,
};

const mockUpdateShare = updateMemoriesShare as jest.MockedFunction<typeof updateMemoriesShare>;
const mockSummary = getMemorySpaceHostSummary as jest.MockedFunction<
	typeof getMemorySpaceHostSummary
>;

function createContext(request: Request) {
	return {
		request,
		params: { eventId: EVENT_ID },
		cookies: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), has: jest.fn() },
		locals: { session: hostSession },
		url: new URL(request.url),
	} as unknown as Parameters<typeof postShare>[0];
}

beforeEach(() => {
	jest.clearAllMocks();
	(requireDashboardSessionFromLocals as jest.Mock).mockReturnValue(hostSession);
	(requireDashboardMutationAccess as jest.Mock).mockResolvedValue(hostSession);
	(requireMemoriesRateLimit as jest.Mock).mockResolvedValue(undefined);
	(requireOrganizerMemorySpace as jest.Mock).mockResolvedValue(space);
});

describe('shared gallery link origin', () => {
	it('passes the serving origin when the host turns sharing on', async () => {
		mockUpdateShare.mockResolvedValue({ shareUrl: null });
		const request = createMockRequest({ action: 'enable' }, undefined, `${EVENT_URL}/share`);

		const response = await postShare(createContext(request));

		expect(response.status).toBe(200);
		expect(mockUpdateShare).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'enable', requestOrigin: PREVIEW_ORIGIN }),
		);
	});

	it('passes the serving origin when the host summary is read', async () => {
		mockSummary.mockResolvedValue({} as Awaited<ReturnType<typeof getMemorySpaceHostSummary>>);
		const request = createMockRequest(undefined, undefined, `${EVENT_URL}/summary`);

		const response = await getSummary(createContext(request));

		expect(response.status).toBe(200);
		expect(mockSummary).toHaveBeenCalledWith(space, expect.any(Date), PREVIEW_ORIGIN);
	});
});
