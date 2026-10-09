jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/memories/server/readiness.service', () => ({
	checkMemoriesReadiness: jest.fn(),
}));

jest.mock('@/lib/memories/server/admin.service', () => ({
	createMemorySpaceAdmin: jest.fn(),
	listMemorySpaceCandidatesAdmin: jest.fn(),
	listMemorySpacesAdmin: jest.fn(),
	updateMemorySpaceAdmin: jest.fn(),
}));

import type { SessionContext } from '@/lib/rsvp/auth/auth';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';
import {
	createMemorySpaceAdmin,
	listMemorySpaceCandidatesAdmin,
	listMemorySpacesAdmin,
	updateMemorySpaceAdmin,
} from '@/lib/memories/server/admin.service';
import { checkMemoriesReadiness } from '@/lib/memories/server/readiness.service';
import { GET as getSpaces, POST as postSpace } from '@/pages/api/dashboard/admin/memories/index';
import { PATCH as patchSpace } from '@/pages/api/dashboard/admin/memories/[eventId]';
import { createMockRequest } from '../helpers/api-mocks';
import { ADMIN_USER_ID, EVENT_ID, PUBLIC_SLUG, buildSpace } from '../unit/memories/fixtures';

const mockMutationAccess = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockAdminRateLimit = requireAdminRateLimit as jest.MockedFunction<
	typeof requireAdminRateLimit
>;
const mockCreate = createMemorySpaceAdmin as jest.MockedFunction<typeof createMemorySpaceAdmin>;
const mockCandidates = listMemorySpaceCandidatesAdmin as jest.MockedFunction<
	typeof listMemorySpaceCandidatesAdmin
>;
const mockListSpaces = listMemorySpacesAdmin as jest.MockedFunction<typeof listMemorySpacesAdmin>;
const mockReadiness = checkMemoriesReadiness as jest.MockedFunction<typeof checkMemoriesReadiness>;
const mockUpdate = updateMemorySpaceAdmin as jest.MockedFunction<typeof updateMemorySpaceAdmin>;

const BASE_URL = 'https://celebra-me.com/api/dashboard/admin/memories';
const space = buildSpace();
const adminSession: SessionContext = {
	userId: ADMIN_USER_ID,
	email: 'admin@example.com',
	accessToken: 'admin-access-token',
	role: 'super_admin',
	isSuperAdmin: true,
};

const adminItem = {
	...space,
	eventDate: '2026-10-30',
	lastHostDownloadAt: null,
	hasOwner: true,
	usage: {
		photos: 0,
		videos: 0,
		guestsWithUploads: 0,
		sessions: 0,
		residentObjects: 0,
		residentBytes: 0,
		inFlight: 0,
		rejected: 0,
		lastAcceptedAt: null,
	},
};
const totals = { residentBytes: 0, committedBytes: space.maxEventBytes };

const candidate = {
	eventId: 'e0000000-0000-4000-8000-0000000000b1',
	eventSlug: 'ana-y-luis',
	eventTitle: 'Ana y Luis',
	eventDate: '2026-11-20',
	defaults: {
		publicSlug: 'ana-y-luis',
		timeZone: 'America/Mazatlan',
		uploadStartsLocal: '2026-11-13T00:00',
		uploadEndsLocal: '2026-11-28T00:00',
		retentionEndsLocal: '2027-01-27T00:00',
		limits: { ...MEMORIES_LIMIT_PROFILES.standard },
	},
};

const createPayload = {
	eventId: EVENT_ID,
	publicSlug: PUBLIC_SLUG,
	timeZone: 'America/Mazatlan',
	uploadStartsLocal: '2026-10-16T00:00',
	uploadEndsLocal: '2026-10-31T00:00',
	retentionEndsLocal: '2026-12-30T00:00',
	entitlement: 'package',
	limits: { ...MEMORIES_LIMIT_PROFILES.standard },
};

type RouteContext = Parameters<typeof getSpaces>[0];

function createContext(request: Request, params: Record<string, string> = {}) {
	const cookies = { get: jest.fn(), set: jest.fn(), delete: jest.fn(), has: jest.fn() };
	const context = {
		request,
		params,
		cookies,
		locals: {},
		url: new URL(request.url),
	} as unknown as RouteContext;
	return { context, cookies };
}

beforeEach(() => {
	jest.clearAllMocks();
	mockAdminRateLimit.mockResolvedValue(undefined);
	mockStrongSession.mockResolvedValue(adminSession);
	mockMutationAccess.mockResolvedValue(adminSession);
	mockListSpaces.mockResolvedValue({ items: [adminItem], totals });
	mockCandidates.mockResolvedValue([candidate]);
	mockReadiness.mockResolvedValue({ missing: ['shareSecret'], unreachable: ['uploadOrigin'] });
});

describe('GET /api/dashboard/admin/memories', () => {
	it('requires the list rate limit and a strong admin session, then returns items and candidates', async () => {
		const request = createMockRequest(undefined, undefined, BASE_URL);

		const response = await getSpaces(createContext(request).context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			items: [adminItem],
			totals,
			candidates: [candidate],
			readiness: { missing: ['shareSecret'], unreachable: ['uploadOrigin'] },
			publicOrigin: new URL(BASE_URL).origin,
		});
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockAdminRateLimit).toHaveBeenCalledWith(request, 'memories:list');
		expect(mockStrongSession).toHaveBeenCalledWith(request);
		expect(mockAdminRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
			mockStrongSession.mock.invocationCallOrder[0],
		);
	});

	it('stops at the rate limit before checking the session', async () => {
		mockAdminRateLimit.mockRejectedValue(
			new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.'),
		);
		const response = await getSpaces(
			createContext(createMockRequest(undefined, undefined, BASE_URL)).context,
		);
		expect(response.status).toBe(429);
		expect(mockStrongSession).not.toHaveBeenCalled();
		expect(mockListSpaces).not.toHaveBeenCalled();
		expect(mockCandidates).not.toHaveBeenCalled();
		expect(mockReadiness).not.toHaveBeenCalled();
	});

	it('answers a weak or non-admin session with a 403 without listing', async () => {
		mockStrongSession.mockRejectedValue(
			new ApiError(403, 'forbidden', 'Strong authentication is required.'),
		);
		const response = await getSpaces(
			createContext(createMockRequest(undefined, undefined, BASE_URL)).context,
		);
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'forbidden' } });
		expect(mockListSpaces).not.toHaveBeenCalled();
		expect(mockCandidates).not.toHaveBeenCalled();
		expect(mockReadiness).not.toHaveBeenCalled();
	});
});

describe('POST /api/dashboard/admin/memories', () => {
	it('creates a space through the admin mutation guard keyed by memories:create', async () => {
		mockCreate.mockResolvedValue(space);
		const request = createMockRequest(createPayload, undefined, BASE_URL);
		const { context, cookies } = createContext(request);

		const response = await postSpace(context);

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({ item: space });
		expect(mockMutationAccess).toHaveBeenCalledWith(request, cookies, 'memories:create');
		expect(mockCreate).toHaveBeenCalledWith(createPayload, ADMIN_USER_ID);
	});

	it('does not touch the service when the mutation guard rejects', async () => {
		mockMutationAccess.mockRejectedValue(new ApiError(403, 'forbidden', 'CSRF inválido.'));
		const response = await postSpace(
			createContext(createMockRequest(createPayload, undefined, BASE_URL)).context,
		);
		expect(response.status).toBe(403);
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it('surfaces validation issues from the service as a JSON 400', async () => {
		mockCreate.mockRejectedValue(
			new ApiError(400, 'validation_error', 'Zona horaria inválida.', {
				issues: [{ path: 'timeZone', message: 'Zona horaria inválida.' }],
			}),
		);
		const response = await postSpace(
			createContext(
				createMockRequest(
					{ ...createPayload, timeZone: 'Mars/Olympus' },
					undefined,
					BASE_URL,
				),
			).context,
		);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			success: false,
			error: {
				code: 'validation_error',
				message: 'Zona horaria inválida.',
				details: { issues: [{ path: 'timeZone', message: 'Zona horaria inválida.' }] },
			},
		});
	});

	it('rejects a non-JSON body after the guard with a 400', async () => {
		const request = createMockRequest('eventId=x', { 'Content-Type': 'text/plain' }, BASE_URL);
		const response = await postSpace(createContext(request).context);
		expect(response.status).toBe(400);
		expect(mockCreate).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/dashboard/admin/memories/[eventId]', () => {
	it('updates a space through the admin mutation guard keyed by memories:update', async () => {
		const updated = buildSpace({ enabled: false });
		mockUpdate.mockResolvedValue(updated);
		const request = createMockRequest({ enabled: false }, undefined, `${BASE_URL}/${EVENT_ID}`);
		const { context, cookies } = createContext(request, { eventId: EVENT_ID });

		const response = await patchSpace(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ item: updated });
		expect(mockMutationAccess).toHaveBeenCalledWith(request, cookies, 'memories:update');
		expect(mockUpdate).toHaveBeenCalledWith(EVENT_ID, { enabled: false }, ADMIN_USER_ID);
	});

	it('rejects a non-uuid event id before the mutation guard', async () => {
		const request = createMockRequest({ enabled: false }, undefined, `${BASE_URL}/abc`);
		const response = await patchSpace(createContext(request, { eventId: 'abc' }).context);
		expect(response.status).toBe(400);
		expect(mockMutationAccess).not.toHaveBeenCalled();
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('maps a missing space to a JSON 404', async () => {
		mockUpdate.mockRejectedValue(
			new ApiError(404, 'not_found', 'El evento no tiene recuerdos.'),
		);
		const request = createMockRequest({ enabled: true }, undefined, `${BASE_URL}/${EVENT_ID}`);
		const response = await patchSpace(createContext(request, { eventId: EVENT_ID }).context);
		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
	});
});
