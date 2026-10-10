jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/memories/server/space.service', () => ({
	requireMemorySpaceByEventId: jest.fn(),
}));

jest.mock('@/lib/memories/server/diagnostics.service', () => ({
	buildMemorySpaceDiagnostics: jest.fn(),
}));

import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { requireMemorySpaceByEventId } from '@/lib/memories/server/space.service';
import { buildMemorySpaceDiagnostics } from '@/lib/memories/server/diagnostics.service';
import type { MemoriesSpaceDiagnostics } from '@/lib/memories/contract/catalog';
import { GET as getDiagnostics } from '@/pages/api/dashboard/admin/memories/[eventId]/diagnostics';
import { ADMIN_USER_ID, EVENT_ID, buildSpace } from '../unit/memories/fixtures';

const mockStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockRateLimit = requireAdminRateLimit as jest.MockedFunction<typeof requireAdminRateLimit>;
const mockSpace = requireMemorySpaceByEventId as jest.MockedFunction<
	typeof requireMemorySpaceByEventId
>;
const mockBuild = buildMemorySpaceDiagnostics as jest.MockedFunction<
	typeof buildMemorySpaceDiagnostics
>;

const BASE_URL = `https://www.celebra-me.com/api/dashboard/admin/memories/${EVENT_ID}/diagnostics`;
const space = buildSpace();

const diagnostics: MemoriesSpaceDiagnostics = {
	eventId: EVENT_ID,
	statusCounts: {
		uploading: 0,
		validating: 0,
		accepted: 3,
		rejected: 1,
		deleted: 0,
		duplicate: 0,
	},
	stalled: { uploading: 0, validating: 0 },
	failures: { size_mismatch: 1 },
	failuresWithoutReason: 0,
	abandoned: 0,
	auditTruncated: false,
	lastAcceptedAt: '2026-10-24T11:00:00.000Z',
	liveChecks: null,
	generatedAt: '2026-10-24T12:00:00.000Z',
};

type RouteContext = Parameters<typeof getDiagnostics>[0];

function context(url: string, eventId = EVENT_ID): RouteContext {
	const request = new Request(url);
	return {
		request,
		params: { eventId },
		url: new URL(url),
		locals: {},
		cookies: {},
	} as unknown as RouteContext;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockRateLimit.mockResolvedValue(undefined);
	mockStrongSession.mockResolvedValue({
		userId: ADMIN_USER_ID,
		email: 'admin@example.com',
		accessToken: 'token',
		role: 'super_admin',
		isSuperAdmin: true,
	});
	mockSpace.mockResolvedValue(space);
	mockBuild.mockResolvedValue(diagnostics);
});

describe('GET /api/dashboard/admin/memories/:eventId/diagnostics', () => {
	it('returns the diagnostics of the space without live checks by default', async () => {
		const response = await getDiagnostics(context(BASE_URL));

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toContain('no-store');
		await expect(response.json()).resolves.toEqual({ diagnostics });
		expect(mockRateLimit).toHaveBeenCalledWith(expect.any(Request), 'memories:diagnostics');
		expect(mockBuild).toHaveBeenCalledWith(space, {
			live: false,
			requestOrigin: 'https://www.celebra-me.com',
		});
	});

	it('runs the live checks only when asked', async () => {
		await getDiagnostics(context(`${BASE_URL}?live=1`));

		expect(mockBuild).toHaveBeenCalledWith(space, expect.objectContaining({ live: true }));
	});

	it('checks the rate limit before the session and reads nothing when either fails', async () => {
		mockRateLimit.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'Too many'));

		const limited = await getDiagnostics(context(BASE_URL));

		expect(limited.status).toBe(429);
		expect(mockStrongSession).not.toHaveBeenCalled();

		mockStrongSession.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'MFA required'));
		const weak = await getDiagnostics(context(BASE_URL));

		expect(weak.status).toBe(403);
		expect(mockBuild).not.toHaveBeenCalled();
	});

	it('answers 404 for an event without a memory space', async () => {
		mockSpace.mockRejectedValueOnce(new ApiError(404, 'not_found', 'Sin espacio'));

		const response = await getDiagnostics(context(BASE_URL));

		expect(response.status).toBe(404);
		expect(mockBuild).not.toHaveBeenCalled();
	});

	it('rejects a malformed event id before any read', async () => {
		const response = await getDiagnostics(context(BASE_URL, 'not-a-uuid'));

		expect(response.status).toBe(400);
		expect(mockSpace).not.toHaveBeenCalled();
	});
});
