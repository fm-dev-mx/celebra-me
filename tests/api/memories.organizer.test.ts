jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireDashboardMutationAccess: jest.fn(),
	requireDashboardSessionFromLocals: jest.fn(),
}));

jest.mock('@/lib/memories/server/organizer.service', () => ({
	listOrganizerMemoryItems: jest.fn(),
	listOrganizerMemorySpaces: jest.fn(),
	requireOrganizerMemorySpace: jest.fn(),
	revokeGuestMemorySession: jest.fn(),
	updateOrganizerMemoryItem: jest.fn(),
}));

jest.mock('@/lib/memories/server/rate-limit', () => ({
	requireMemoriesRateLimit: jest.fn(),
}));

jest.mock('@/lib/memories/server/guest-media.service', () => ({
	getMediaObjectForRetrieval: jest.fn(),
}));

jest.mock('@/lib/memories/server/worker-gateway', () => ({
	retrieveMemoriesObject: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	recordMemoriesAccess: jest.fn(),
}));

import type { MemoriesMediaPublicItem } from '@/lib/memories/contract/catalog';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import {
	requireDashboardMutationAccess,
	requireDashboardSessionFromLocals,
} from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { recordMemoriesAccess } from '@/lib/memories/server/audit';
import { getMediaObjectForRetrieval } from '@/lib/memories/server/guest-media.service';
import {
	listOrganizerMemoryItems,
	listOrganizerMemorySpaces,
	requireOrganizerMemorySpace,
	revokeGuestMemorySession,
	updateOrganizerMemoryItem,
} from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { retrieveMemoriesObject } from '@/lib/memories/server/worker-gateway';
import { GET as getSpaces } from '@/pages/api/dashboard/memories/index';
import { GET as getList, POST as postSpace } from '@/pages/api/dashboard/memories/[eventId]/index';
import {
	DELETE as deleteItem,
	GET as getItem,
	PATCH as patchItem,
} from '@/pages/api/dashboard/memories/[eventId]/items/[itemId]';
import { createMockRequest } from '../helpers/api-mocks';
import {
	EVENT_ID,
	GUEST_ALIAS,
	ITEM_ID,
	OBJECT_KEY,
	OWNER_USER_ID,
	PUBLIC_SLUG,
	buildSpace,
} from '../unit/memories/fixtures';

const mockMutationAccess = requireDashboardMutationAccess as jest.MockedFunction<
	typeof requireDashboardMutationAccess
>;
const mockSessionFromLocals = requireDashboardSessionFromLocals as jest.MockedFunction<
	typeof requireDashboardSessionFromLocals
>;
const mockListItems = listOrganizerMemoryItems as jest.MockedFunction<
	typeof listOrganizerMemoryItems
>;
const mockListSpaces = listOrganizerMemorySpaces as jest.MockedFunction<
	typeof listOrganizerMemorySpaces
>;
const mockRequireSpace = requireOrganizerMemorySpace as jest.MockedFunction<
	typeof requireOrganizerMemorySpace
>;
const mockRevoke = revokeGuestMemorySession as jest.MockedFunction<typeof revokeGuestMemorySession>;
const mockUpdateItem = updateOrganizerMemoryItem as jest.MockedFunction<
	typeof updateOrganizerMemoryItem
>;
const mockRateLimit = requireMemoriesRateLimit as jest.MockedFunction<
	typeof requireMemoriesRateLimit
>;
const mockObject = getMediaObjectForRetrieval as jest.MockedFunction<
	typeof getMediaObjectForRetrieval
>;
const mockRetrieve = retrieveMemoriesObject as jest.MockedFunction<typeof retrieveMemoriesObject>;
const mockAccess = recordMemoriesAccess as jest.MockedFunction<typeof recordMemoriesAccess>;

const BASE_URL = 'https://celebra-me.com/api/dashboard/memories';
const EVENT_URL = `${BASE_URL}/${EVENT_ID}`;
const ITEM_URL = `${EVENT_URL}/items/${ITEM_ID}`;
const space = buildSpace();
const hostSession: SessionContext = {
	userId: OWNER_USER_ID,
	email: 'host@example.com',
	accessToken: 'host-access-token',
	role: 'host_client',
	isSuperAdmin: false,
};

const publicItem: MemoriesMediaPublicItem = {
	id: ITEM_ID,
	mimeType: 'image/jpeg',
	sizeBytes: 1_048_576,
	durationSeconds: null,
	caption: '',
	status: 'accepted',
	createdAt: '2026-10-24T11:00:00.000Z',
	updatedAt: '2026-10-24T11:05:00.000Z',
	acceptedAt: '2026-10-24T11:05:00.000Z',
	rejectedAt: null,
	deletedAt: null,
};

type RouteContext = Parameters<typeof getList>[0];

function createContext(request: Request, params: Record<string, string> = {}) {
	const cookies = { get: jest.fn(), set: jest.fn(), delete: jest.fn(), has: jest.fn() };
	const locals = { session: hostSession };
	const context = {
		request,
		params,
		cookies,
		locals,
		url: new URL(request.url),
	} as unknown as RouteContext;
	return { context, cookies, locals };
}

function eventParams(eventId = EVENT_ID) {
	return { eventId };
}

function itemParams(eventId = EVENT_ID, itemId = ITEM_ID) {
	return { eventId, itemId };
}

beforeEach(() => {
	jest.clearAllMocks();
	mockSessionFromLocals.mockReturnValue(hostSession);
	mockMutationAccess.mockResolvedValue(hostSession);
	mockRateLimit.mockResolvedValue(undefined);
	mockRequireSpace.mockResolvedValue(space);
	mockListItems.mockResolvedValue({ items: [], nextPage: null });
});

describe('GET /api/dashboard/memories', () => {
	it('lists the owned spaces as public summaries with their event id', async () => {
		mockListSpaces.mockResolvedValue([space]);
		const request = createMockRequest(undefined, undefined, BASE_URL);

		const response = await getSpaces(createContext(request).context);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.items).toHaveLength(1);
		expect(body.items[0]).toMatchObject({
			eventId: EVENT_ID,
			publicSlug: PUBLIC_SLUG,
			eventTitle: 'Victoria y Roberto',
			timeZone: 'America/Mazatlan',
		});
		expect(body.items[0]).not.toHaveProperty('maxEventObjects');
		expect(body.items[0]).not.toHaveProperty('entitlement');
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'organizer', OWNER_USER_ID);
		expect(mockListSpaces).toHaveBeenCalledWith(hostSession);
	});
});

describe('GET /api/dashboard/memories/[eventId]', () => {
	it('rejects a non-uuid event id before resolving the session', async () => {
		const request = createMockRequest(undefined, undefined, `${BASE_URL}/abc`);
		const response = await getList(createContext(request, eventParams('abc')).context);

		expect(response.status).toBe(400);
		expect(mockSessionFromLocals).not.toHaveBeenCalled();
		expect(mockRateLimit).not.toHaveBeenCalled();
	});

	it('forwards validated filters to the service and includes the space summary', async () => {
		mockListItems.mockResolvedValue({
			items: [
				{ ...publicItem, uploader: { displayName: 'Tía Ana', guestAlias: GUEST_ALIAS } },
			],
			nextPage: 3,
		});
		const request = createMockRequest(
			undefined,
			undefined,
			`${EVENT_URL}?page=2&status=accepted&uploader=T%C3%ADa+Ana&createdFrom=2026-10-24T00%3A00%3A00.000Z&createdTo=2026-10-25T00%3A00%3A00.000Z`,
		);
		const { context, locals } = createContext(request, eventParams());

		const response = await getList(context);

		expect(response.status).toBe(200);
		expect(mockSessionFromLocals).toHaveBeenCalledWith(locals);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'organizer', OWNER_USER_ID);
		expect(mockRequireSpace).toHaveBeenCalledWith(EVENT_ID, hostSession);
		expect(mockListItems).toHaveBeenCalledWith(space, {
			page: 2,
			status: 'accepted',
			uploader: 'Tía Ana',
			createdFrom: '2026-10-24T00:00:00.000Z',
			createdTo: '2026-10-25T00:00:00.000Z',
		});
		const body = await response.json();
		expect(body.items).toHaveLength(1);
		expect(body.nextPage).toBe(3);
		expect(body.space).toMatchObject({
			publicSlug: PUBLIC_SLUG,
			eventTitle: 'Victoria y Roberto',
			timeZone: 'America/Mazatlan',
			uploadStartsAt: space.uploadStartsAt,
			uploadEndsAt: space.uploadEndsAt,
			retentionEndsAt: space.retentionEndsAt,
		});
		expect(['disabled', 'before', 'open', 'closed', 'expired']).toContain(
			body.space.windowState,
		);
		expect(body.space).not.toHaveProperty('maxEventObjects');
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it('defaults to the first page without filters', async () => {
		const request = createMockRequest(undefined, undefined, EVENT_URL);
		await getList(createContext(request, eventParams()).context);
		expect(mockListItems).toHaveBeenCalledWith(space, {
			page: 0,
			status: undefined,
			uploader: undefined,
			createdFrom: undefined,
			createdTo: undefined,
		});
	});

	it.each(['abc', '-1', '12345', '1.5'])('rejects page %p with a 400', async (page) => {
		const request = createMockRequest(undefined, undefined, `${EVENT_URL}?page=${page}`);
		const response = await getList(createContext(request, eventParams()).context);
		expect(response.status).toBe(400);
		expect(mockListItems).not.toHaveBeenCalled();
	});

	it('rejects an unknown status before querying', async () => {
		const request = createMockRequest(undefined, undefined, `${EVENT_URL}?status=private`);
		const response = await getList(createContext(request, eventParams()).context);
		expect(response.status).toBe(400);
		expect(mockListItems).not.toHaveBeenCalled();
	});

	it('answers a missing dashboard session with a 401 before rate limiting', async () => {
		mockSessionFromLocals.mockImplementation(() => {
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		});
		const request = createMockRequest(undefined, undefined, EVENT_URL);
		const response = await getList(createContext(request, eventParams()).context);
		expect(response.status).toBe(401);
		expect(mockRateLimit).not.toHaveBeenCalled();
		expect(mockRequireSpace).not.toHaveBeenCalled();
	});

	it('propagates owner access failures as a 403', async () => {
		mockRequireSpace.mockRejectedValue(new ApiError(403, 'forbidden', 'No autorizado.'));
		const request = createMockRequest(undefined, undefined, EVENT_URL);
		const response = await getList(createContext(request, eventParams()).context);
		expect(response.status).toBe(403);
		expect(mockListItems).not.toHaveBeenCalled();
	});
});

describe('POST /api/dashboard/memories/[eventId]', () => {
	it('revokes a guest session through the CSRF-protected mutation path', async () => {
		mockRevoke.mockResolvedValue(undefined);
		const request = createMockRequest(
			{ action: 'revoke_session', guestAlias: GUEST_ALIAS },
			undefined,
			EVENT_URL,
		);
		const { context, cookies, locals } = createContext(request, eventParams());

		const response = await postSpace(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
		expect(mockMutationAccess).toHaveBeenCalledWith(request, cookies, locals);
		expect(mockSessionFromLocals).not.toHaveBeenCalled();
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'organizer', OWNER_USER_ID);
		expect(mockMutationAccess.mock.invocationCallOrder[0]).toBeLessThan(
			mockRateLimit.mock.invocationCallOrder[0],
		);
		expect(mockRevoke).toHaveBeenCalledWith({
			space,
			guestAlias: GUEST_ALIAS,
			actorId: OWNER_USER_ID,
		});
	});

	it('rejects unknown actions with a 400', async () => {
		const request = createMockRequest({ action: 'purge' }, undefined, EVENT_URL);
		const response = await postSpace(createContext(request, eventParams()).context);
		expect(response.status).toBe(400);
		expect(mockRevoke).not.toHaveBeenCalled();
	});

	it('stops at the mutation guard when CSRF validation fails', async () => {
		mockMutationAccess.mockRejectedValue(new ApiError(403, 'forbidden', 'CSRF inválido.'));
		const request = createMockRequest(
			{ action: 'revoke_session', guestAlias: GUEST_ALIAS },
			undefined,
			EVENT_URL,
		);
		const response = await postSpace(createContext(request, eventParams()).context);
		expect(response.status).toBe(403);
		expect(mockRateLimit).not.toHaveBeenCalled();
		expect(mockRequireSpace).not.toHaveBeenCalled();
		expect(mockRevoke).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/dashboard/memories/[eventId]/items/[itemId]', () => {
	it('moderates an item through the mutation guard', async () => {
		mockUpdateItem.mockResolvedValue({ ...publicItem, status: 'rejected' });
		const request = createMockRequest(
			{ status: 'rejected', caption: 'x' },
			undefined,
			ITEM_URL,
		);
		const { context, cookies, locals } = createContext(request, itemParams());

		const response = await patchItem(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			item: { ...publicItem, status: 'rejected' },
		});
		expect(mockMutationAccess).toHaveBeenCalledWith(request, cookies, locals);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'organizer', OWNER_USER_ID);
		expect(mockUpdateItem).toHaveBeenCalledWith({
			space,
			mediaItemId: ITEM_ID,
			caption: 'x',
			status: 'rejected',
			actorId: OWNER_USER_ID,
		});
	});

	it('rejects a non-uuid event or item id before the mutation guard', async () => {
		const badEvent = createMockRequest(
			{ status: 'deleted' },
			undefined,
			`${BASE_URL}/abc/items/${ITEM_ID}`,
		);
		expect((await patchItem(createContext(badEvent, itemParams('abc')).context)).status).toBe(
			400,
		);
		const badItem = createMockRequest(
			{ status: 'deleted' },
			undefined,
			`${EVENT_URL}/items/abc`,
		);
		expect(
			(await patchItem(createContext(badItem, itemParams(EVENT_ID, 'abc')).context)).status,
		).toBe(400);
		expect(mockMutationAccess).not.toHaveBeenCalled();
	});

	it.each([
		['an array', []],
		['a JSON null', 'null'],
	])('rejects %s as the body with a 400 before moderating', async (_label, body) => {
		const request = createMockRequest(body, undefined, ITEM_URL);
		const response = await patchItem(createContext(request, itemParams()).context);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'bad_request' } });
		expect(mockUpdateItem).not.toHaveBeenCalled();
	});

	it('maps a forbidden transition to a JSON 409', async () => {
		mockUpdateItem.mockRejectedValue(new ApiError(409, 'conflict', 'Transición no permitida.'));
		const request = createMockRequest({ status: 'uploading' }, undefined, ITEM_URL);
		const response = await patchItem(createContext(request, itemParams()).context);
		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'conflict' } });
	});
});

describe('DELETE /api/dashboard/memories/[eventId]/items/[itemId]', () => {
	it('deletes through the mutation guard and returns success', async () => {
		mockUpdateItem.mockResolvedValue({ ...publicItem, status: 'deleted' });
		const request = createMockRequest(undefined, undefined, ITEM_URL);
		const { context, cookies, locals } = createContext(request, itemParams());

		const response = await deleteItem(context);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
		expect(mockMutationAccess).toHaveBeenCalledWith(request, cookies, locals);
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'organizer', OWNER_USER_ID);
		expect(mockUpdateItem).toHaveBeenCalledWith({
			space,
			mediaItemId: ITEM_ID,
			status: 'deleted',
			actorId: OWNER_USER_ID,
		});
	});
});

describe('GET /api/dashboard/memories/[eventId]/items/[itemId]', () => {
	const object = { objectKey: OBJECT_KEY, mimeType: 'image/jpeg', downloadName: 'recuerdo.jpg' };

	it('downloads as attachment by default and records the organizer access', async () => {
		mockObject.mockResolvedValue(object);
		const upstream = new Response('binary', { status: 200 });
		mockRetrieve.mockResolvedValue(upstream);
		const request = createMockRequest(undefined, undefined, ITEM_URL);
		const { context, locals } = createContext(request, itemParams());

		const response = await getItem(context);

		expect(response).toBe(upstream);
		expect(mockSessionFromLocals).toHaveBeenCalledWith(locals);
		expect(mockMutationAccess).not.toHaveBeenCalled();
		expect(mockRateLimit).toHaveBeenCalledWith(request, 'organizer', OWNER_USER_ID);
		expect(mockObject).toHaveBeenCalledWith(space, ITEM_ID);
		expect(mockRetrieve).toHaveBeenCalledWith({ ...object, mode: 'attachment', range: null });
		expect(mockAccess).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			mediaItemId: ITEM_ID,
			actorType: 'organizer',
			actorId: OWNER_USER_ID,
			mode: 'attachment',
		});
	});

	it('streams inline for previews and forwards the range header', async () => {
		mockObject.mockResolvedValue(object);
		mockRetrieve.mockResolvedValue(new Response('binary', { status: 206 }));
		const request = createMockRequest(
			undefined,
			{ range: 'bytes=0-511' },
			`${ITEM_URL}?mode=preview`,
		);

		const response = await getItem(createContext(request, itemParams()).context);

		expect(response.status).toBe(206);
		expect(mockRetrieve).toHaveBeenCalledWith({
			...object,
			mode: 'inline',
			range: 'bytes=0-511',
		});
		expect(mockAccess).toHaveBeenCalledWith(expect.objectContaining({ mode: 'inline' }));
	});

	it('returns an empty 404 without recording access when the worker refuses', async () => {
		mockObject.mockResolvedValue(object);
		mockRetrieve.mockResolvedValue(new Response(null, { status: 404 }));
		const request = createMockRequest(undefined, undefined, ITEM_URL);

		const response = await getItem(createContext(request, itemParams()).context);

		expect(response.status).toBe(404);
		expect(mockAccess).not.toHaveBeenCalled();
	});
});
