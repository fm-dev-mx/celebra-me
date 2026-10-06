jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
	requireDashboardSessionFromLocals: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/memories/server/rate-limit', () => ({
	requireMemoriesRateLimit: jest.fn(),
}));

jest.mock('@/lib/memories/server/organizer.service', () => ({
	requireOrganizerMemorySpace: jest.fn(),
}));

jest.mock('@/lib/memories/server/space.service', () => ({
	...jest.requireActual('@/lib/memories/server/space.service'),
	requireMemorySpaceByEventId: jest.fn(),
}));

jest.mock('@/lib/memories/server/catalog.repository', () => ({
	listResidentMediaUsage: jest.fn(),
	listSessionEventIds: jest.fn(),
}));

import { createHash } from 'node:crypto';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import {
	requireAdminStrongSession,
	requireDashboardSessionFromLocals,
} from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import {
	listResidentMediaUsage,
	listSessionEventIds,
} from '@/lib/memories/server/catalog.repository';
import { requireOrganizerMemorySpace } from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireMemorySpaceByEventId } from '@/lib/memories/server/space.service';
import { GET as getAdminQr } from '@/pages/api/dashboard/admin/memories/[eventId]/qr';
import { GET as getHostSummary } from '@/pages/api/dashboard/memories/[eventId]/summary';
import { GET as getHostQr } from '@/pages/api/dashboard/memories/[eventId]/qr';
import { createMockRequest } from '../helpers/api-mocks';
import {
	ADMIN_USER_ID,
	EVENT_ID,
	OWNER_USER_ID,
	PUBLIC_SLUG,
	SESSION_ID,
	buildSpace,
} from '../unit/memories/fixtures';

const mockStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockSessionFromLocals = requireDashboardSessionFromLocals as jest.MockedFunction<
	typeof requireDashboardSessionFromLocals
>;
const mockAdminRateLimit = requireAdminRateLimit as jest.MockedFunction<
	typeof requireAdminRateLimit
>;
const mockHostRateLimit = requireMemoriesRateLimit as jest.MockedFunction<
	typeof requireMemoriesRateLimit
>;
const mockRequireOwnedSpace = requireOrganizerMemorySpace as jest.MockedFunction<
	typeof requireOrganizerMemorySpace
>;
const mockRequireSpace = requireMemorySpaceByEventId as jest.MockedFunction<
	typeof requireMemorySpaceByEventId
>;
const mockResident = listResidentMediaUsage as jest.MockedFunction<typeof listResidentMediaUsage>;
const mockSessions = listSessionEventIds as jest.MockedFunction<typeof listSessionEventIds>;

/** SHA-256 of the SVG delivered for printing on 2026-09-30. */
const PRINTED_SVG_SHA256 = '3c28cfa2c9bb6cf497d641ce19bfbd3741bac804c6cc1af39904f6617596a2e2';
const ADMIN_URL = 'https://celebra-me.com/api/dashboard/admin/memories';
const HOST_URL = `https://celebra-me.com/api/dashboard/memories/${EVENT_ID}`;
const space = buildSpace({ enabled: true });
const adminSession: SessionContext = {
	userId: ADMIN_USER_ID,
	email: 'admin@example.com',
	accessToken: 'admin-access-token',
	role: 'super_admin',
	isSuperAdmin: true,
};
const hostSession: SessionContext = {
	userId: OWNER_USER_ID,
	email: 'host@example.com',
	accessToken: 'host-access-token',
	role: 'host_client',
	isSuperAdmin: false,
};

type RouteContext = Parameters<typeof getHostSummary>[0];

function context(url: string, params: Record<string, string> = {}): RouteContext {
	const request = createMockRequest(undefined, undefined, url);
	return {
		request,
		params,
		cookies: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), has: jest.fn() },
		locals: { session: hostSession },
		url: new URL(request.url),
	} as unknown as RouteContext;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockAdminRateLimit.mockResolvedValue(undefined);
	mockStrongSession.mockResolvedValue(adminSession);
	mockHostRateLimit.mockResolvedValue(undefined);
	mockSessionFromLocals.mockReturnValue(hostSession);
	mockRequireOwnedSpace.mockResolvedValue(space);
	mockRequireSpace.mockResolvedValue(space);
	mockSessions.mockResolvedValue([EVENT_ID, EVENT_ID]);
	mockResident.mockResolvedValue([
		{
			id: 'i1',
			event_id: EVENT_ID,
			session_id: SESSION_ID,
			status: 'accepted',
			mime_type: 'image/jpeg',
			size_bytes: 2_000_000_000,
			accepted_at: '2026-10-24T11:05:00.000Z',
		},
		{
			id: 'i2',
			event_id: EVENT_ID,
			session_id: SESSION_ID,
			status: 'rejected',
			mime_type: 'video/mp4',
			size_bytes: 1_000,
			accepted_at: null,
		},
	]);
});

describe('GET /api/dashboard/admin/memories/[eventId]/qr', () => {
	it('downloads the printed SVG for the space as an attachment', async () => {
		const response = await getAdminQr(
			context(`${ADMIN_URL}/${EVENT_ID}/qr`, { eventId: EVENT_ID }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
		expect(response.headers.get('Content-Disposition')).toBe(
			`attachment; filename="qr-recuerdos-${PUBLIC_SLUG}.svg"`,
		);
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		const svg = await response.text();
		expect(createHash('sha256').update(svg, 'utf8').digest('hex')).toBe(PRINTED_SVG_SHA256);
		expect(mockAdminRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(String) }),
			'memories:qr',
		);
	});

	it('rejects a non-admin session before resolving the space', async () => {
		mockStrongSession.mockRejectedValue(new ApiError(403, 'forbidden', 'Sin acceso.'));
		const response = await getAdminQr(
			context(`${ADMIN_URL}/${EVENT_ID}/qr`, { eventId: EVENT_ID }),
		);

		expect(response.status).toBe(403);
		expect(mockRequireSpace).not.toHaveBeenCalled();
	});

	it('rejects a malformed event id', async () => {
		const response = await getAdminQr(context(`${ADMIN_URL}/x/qr`, { eventId: 'x' }));
		expect(response.status).toBe(400);
		expect(mockStrongSession).not.toHaveBeenCalled();
	});
});

describe('GET /api/dashboard/memories/[eventId]/summary', () => {
	it('returns the host projection without limits, origin, rejections or guest identity', async () => {
		const response = await getHostSummary(
			context(`${HOST_URL}/summary`, { eventId: EVENT_ID }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		const { summary } = (await response.json()) as { summary: Record<string, unknown> };
		expect(Object.keys(summary).sort()).toEqual(
			[
				'capacityRemainingPercent',
				'eventTitle',
				'expectedGuests',
				'guestsWithUploads',
				'lastAcceptedAt',
				'photos',
				'publicSlug',
				'publicUrl',
				'retentionEndsAt',
				'shareUrl',
				'timeZone',
				'uploadEndsAt',
				'uploadStartsAt',
				'videos',
				'windowState',
			].sort(),
		);
		expect(summary).not.toHaveProperty('adminNote');
		// Attendance planning is shared with the host; the internal note never is.
		expect(summary).toHaveProperty('expectedGuests');
		expect(summary).toMatchObject({
			photos: 1,
			videos: 0,
			guestsWithUploads: 1,
			publicUrl: `https://celebra-me.com/r/${PUBLIC_SLUG}`,
			capacityRemainingPercent: 59,
		});
		expect(JSON.stringify(summary)).not.toContain(SESSION_ID);
		expect(mockRequireOwnedSpace).toHaveBeenCalledWith(EVENT_ID, hostSession);
		expect(mockHostRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(String) }),
			'organizer',
			OWNER_USER_ID,
		);
	});

	it('stops when the host does not own the event', async () => {
		mockRequireOwnedSpace.mockRejectedValue(
			new ApiError(403, 'forbidden', 'No tiene autorización para este evento.'),
		);
		const response = await getHostSummary(
			context(`${HOST_URL}/summary`, { eventId: EVENT_ID }),
		);

		expect(response.status).toBe(403);
		expect(mockResident).not.toHaveBeenCalled();
	});
});

describe('GET /api/dashboard/memories/[eventId]/qr', () => {
	it('serves the same SVG to the owning host', async () => {
		const response = await getHostQr(context(`${HOST_URL}/qr`, { eventId: EVENT_ID }));

		expect(response.status).toBe(200);
		const svg = await response.text();
		expect(createHash('sha256').update(svg, 'utf8').digest('hex')).toBe(PRINTED_SVG_SHA256);
	});

	it('does not serve a QR for an event the host does not own', async () => {
		mockRequireOwnedSpace.mockRejectedValue(new ApiError(404, 'not_found', 'No encontrado.'));
		const response = await getHostQr(context(`${HOST_URL}/qr`, { eventId: EVENT_ID }));

		expect(response.status).toBe(404);
	});
});
