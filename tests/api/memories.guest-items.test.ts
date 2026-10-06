jest.mock('@/lib/memories/server/route-guards', () => ({
	...jest.requireActual<typeof import('@/lib/memories/server/route-guards')>(
		'@/lib/memories/server/route-guards',
	),
	requireGuestContext: jest.fn(),
}));

jest.mock('@/lib/memories/server/guest-media.service', () => ({
	completeGuestMemoryItem: jest.fn(),
	deleteGuestMemoryItem: jest.fn(),
	getMediaObjectForRetrieval: jest.fn(),
	listGuestMemoryItems: jest.fn(),
	reserveGuestMemoryItem: jest.fn(),
	updateGuestMemoryCaption: jest.fn(),
}));

jest.mock('@/lib/memories/server/worker-gateway', () => ({
	retrieveMemoriesObject: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	recordMemoriesAccess: jest.fn(),
}));

import type { MemoriesMediaPublicItem } from '@/lib/memories/contract/catalog';
import { ApiError } from '@/lib/rsvp/core/errors';
import { recordMemoriesAccess } from '@/lib/memories/server/audit';
import {
	completeGuestMemoryItem,
	deleteGuestMemoryItem,
	getMediaObjectForRetrieval,
	listGuestMemoryItems,
	reserveGuestMemoryItem,
	updateGuestMemoryCaption,
} from '@/lib/memories/server/guest-media.service';
import { requireGuestContext } from '@/lib/memories/server/route-guards';
import { retrieveMemoriesObject } from '@/lib/memories/server/worker-gateway';
import { GET as getItems, POST as postItems } from '@/pages/api/memories/[slug]/items/index';
import {
	DELETE as deleteItem,
	GET as getItem,
	PATCH as patchItem,
	POST as postItem,
} from '@/pages/api/memories/[slug]/items/[itemId]';
import { createMockRequest } from '../helpers/api-mocks';
import {
	CHECKSUM_SHA256,
	CLIENT_REQUEST_ID,
	EVENT_ID,
	ITEM_ID,
	OBJECT_KEY,
	PUBLIC_SLUG,
	SESSION_ID,
	buildSessionRow,
	buildSpace,
	buildUploadCapability,
} from '../unit/memories/fixtures';

const mockGuestContext = requireGuestContext as jest.MockedFunction<typeof requireGuestContext>;
const mockList = listGuestMemoryItems as jest.MockedFunction<typeof listGuestMemoryItems>;
const mockReserve = reserveGuestMemoryItem as jest.MockedFunction<typeof reserveGuestMemoryItem>;
const mockComplete = completeGuestMemoryItem as jest.MockedFunction<typeof completeGuestMemoryItem>;
const mockDelete = deleteGuestMemoryItem as jest.MockedFunction<typeof deleteGuestMemoryItem>;
const mockCaption = updateGuestMemoryCaption as jest.MockedFunction<
	typeof updateGuestMemoryCaption
>;
const mockObject = getMediaObjectForRetrieval as jest.MockedFunction<
	typeof getMediaObjectForRetrieval
>;
const mockRetrieve = retrieveMemoriesObject as jest.MockedFunction<typeof retrieveMemoriesObject>;
const mockAccess = recordMemoriesAccess as jest.MockedFunction<typeof recordMemoriesAccess>;

const ITEMS_URL = `https://celebra-me.com/api/memories/${PUBLIC_SLUG}/items`;
const space = buildSpace();
const session = buildSessionRow();

const publicItem: MemoriesMediaPublicItem = {
	id: ITEM_ID,
	mimeType: 'image/jpeg',
	sizeBytes: 1_048_576,
	durationSeconds: null,
	caption: '',
	status: 'uploading',
	createdAt: '2026-10-24T11:00:00.000Z',
	updatedAt: '2026-10-24T11:00:00.000Z',
	acceptedAt: null,
	rejectedAt: null,
	deletedAt: null,
	hasThumbnail: false,
};

type RouteContext = Parameters<typeof getItems>[0];

function createContext(request: Request, params: Record<string, string>): RouteContext {
	return {
		request,
		params,
		cookies: {},
		locals: {},
		url: new URL(request.url),
	} as unknown as RouteContext;
}

function itemParams(itemId = ITEM_ID) {
	return { slug: PUBLIC_SLUG, itemId };
}

beforeEach(() => {
	jest.clearAllMocks();
	mockGuestContext.mockResolvedValue({ space, session });
});

describe('item id validation', () => {
	it.each([
		['PATCH', patchItem, { caption: 'x' }],
		['POST', postItem, { action: 'complete' }],
		['DELETE', deleteItem, undefined],
		['GET', getItem, undefined],
	] as const)(
		'%s rejects a non-uuid item id before any lookup',
		async (_method, handler, body) => {
			const request = createMockRequest(body, undefined, `${ITEMS_URL}/abc`);
			const response = await handler(createContext(request, itemParams('abc')));

			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toMatchObject({
				error: { code: 'bad_request' },
			});
			expect(mockGuestContext).not.toHaveBeenCalled();
			expect(mockObject).not.toHaveBeenCalled();
		},
	);
});

describe('GET /api/memories/[slug]/items', () => {
	it('lists the guest items under the read limit', async () => {
		const payload = {
			items: [publicItem],
			quota: {
				files: { used: 1, remaining: 19, limit: 20 },
				videos: { used: 0, remaining: 5, limit: 5 },
				bytes: { used: 1_048_576, remaining: 535_822_336, limit: 536_870_912 },
				inFlight: { used: 1, remaining: 1, limit: 2 },
			},
			eventFull: false,
		};
		mockList.mockResolvedValue(payload);
		const request = createMockRequest(undefined, undefined, ITEMS_URL);

		const response = await getItems(createContext(request, { slug: PUBLIC_SLUG }));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(payload);
		expect(mockGuestContext).toHaveBeenCalledWith(request, { slug: PUBLIC_SLUG }, 'read');
		expect(mockList).toHaveBeenCalledWith(space, session);
	});

	it('answers a missing session with a JSON 401', async () => {
		mockGuestContext.mockRejectedValue(
			new ApiError(401, 'unauthorized', 'Inicie una sesión de recuerdos.'),
		);
		const response = await getItems(
			createContext(createMockRequest(undefined, undefined, ITEMS_URL), {
				slug: PUBLIC_SLUG,
			}),
		);
		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'unauthorized' } });
		expect(mockList).not.toHaveBeenCalled();
	});
});

describe('POST /api/memories/[slug]/items', () => {
	it('reserves an item and returns the upload capability with a 201', async () => {
		const reservation = { item: publicItem, upload: buildUploadCapability() };
		mockReserve.mockResolvedValue(reservation);
		const request = createMockRequest(
			{
				action: 'reserve',
				mimeType: 'image/jpeg',
				sizeBytes: 1_048_576,
				checksumSha256: CHECKSUM_SHA256,
				clientRequestId: CLIENT_REQUEST_ID,
			},
			undefined,
			ITEMS_URL,
		);

		const response = await postItems(createContext(request, { slug: PUBLIC_SLUG }));

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual(reservation);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockGuestContext).toHaveBeenCalledWith(request, { slug: PUBLIC_SLUG }, 'register');
		expect(mockReserve).toHaveBeenCalledWith({
			space,
			session,
			mimeType: 'image/jpeg',
			sizeBytes: 1_048_576,
			checksumSha256: CHECKSUM_SHA256,
			durationSeconds: undefined,
			clientRequestId: CLIENT_REQUEST_ID,
		});
	});

	it('rejects other actions with a 400', async () => {
		const request = createMockRequest({ action: 'upload' }, undefined, ITEMS_URL);
		const response = await postItems(createContext(request, { slug: PUBLIC_SLUG }));
		expect(response.status).toBe(400);
		expect(mockReserve).not.toHaveBeenCalled();
	});

	it('maps service quota failures to their JSON status', async () => {
		mockReserve.mockRejectedValue(new ApiError(409, 'limit_reached', 'Sin espacio.'));
		const request = createMockRequest({ action: 'reserve' }, undefined, ITEMS_URL);
		const response = await postItems(createContext(request, { slug: PUBLIC_SLUG }));
		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'limit_reached' } });
	});
});

describe('GET /api/memories/[slug]/items/[itemId]', () => {
	const object = { objectKey: OBJECT_KEY, mimeType: 'image/jpeg', downloadName: 'recuerdo.jpg' };

	it('proxies the worker response and records the access on success', async () => {
		mockObject.mockResolvedValue(object);
		const upstream = new Response('binary', {
			status: 200,
			headers: { 'content-type': 'image/jpeg' },
		});
		mockRetrieve.mockResolvedValue(upstream);
		const request = createMockRequest(
			undefined,
			{ range: 'bytes=0-1023' },
			`${ITEMS_URL}/${ITEM_ID}`,
		);

		const response = await getItem(createContext(request, itemParams()));

		expect(response).toBe(upstream);
		expect(mockGuestContext).toHaveBeenCalledWith(request, itemParams(), 'read');
		expect(mockObject).toHaveBeenCalledWith(space, ITEM_ID, SESSION_ID, {
			variant: 'original',
		});
		expect(mockRetrieve).toHaveBeenCalledWith({
			...object,
			mode: 'inline',
			range: 'bytes=0-1023',
		});
		expect(mockAccess).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			mediaItemId: ITEM_ID,
			actorType: 'guest',
			mode: 'inline',
		});
	});

	it('returns an empty 404 and records nothing when the worker refuses', async () => {
		mockObject.mockResolvedValue(object);
		mockRetrieve.mockResolvedValue(new Response(null, { status: 404 }));
		const request = createMockRequest(undefined, undefined, `${ITEMS_URL}/${ITEM_ID}`);

		const response = await getItem(createContext(request, itemParams()));

		expect(response.status).toBe(404);
		expect(mockAccess).not.toHaveBeenCalled();
	});

	it('answers a hidden item with a JSON 404 before calling the worker', async () => {
		mockObject.mockRejectedValue(new ApiError(404, 'not_found', 'Recuerdo no disponible.'));
		const request = createMockRequest(undefined, undefined, `${ITEMS_URL}/${ITEM_ID}`);

		const response = await getItem(createContext(request, itemParams()));

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
		expect(mockRetrieve).not.toHaveBeenCalled();
		expect(mockAccess).not.toHaveBeenCalled();
	});
});

describe('POST /api/memories/[slug]/items/[itemId]', () => {
	it('completes the upload and returns the item', async () => {
		mockComplete.mockResolvedValue({ ...publicItem, status: 'accepted' });
		const request = createMockRequest(
			{ action: 'complete' },
			undefined,
			`${ITEMS_URL}/${ITEM_ID}`,
		);

		const response = await postItem(createContext(request, itemParams()));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			item: { ...publicItem, status: 'accepted' },
		});
		expect(mockGuestContext).toHaveBeenCalledWith(request, itemParams(), 'mutate');
		expect(mockComplete).toHaveBeenCalledWith({ space, session, mediaItemId: ITEM_ID });
	});

	it('rejects other actions with a 400', async () => {
		const request = createMockRequest(
			{ action: 'reserve' },
			undefined,
			`${ITEMS_URL}/${ITEM_ID}`,
		);
		const response = await postItem(createContext(request, itemParams()));
		expect(response.status).toBe(400);
		expect(mockComplete).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/memories/[slug]/items/[itemId]', () => {
	it('updates the caption and returns the item', async () => {
		mockCaption.mockResolvedValue({ ...publicItem, caption: 'Brindis' });
		const request = createMockRequest(
			{ caption: 'Brindis' },
			undefined,
			`${ITEMS_URL}/${ITEM_ID}`,
		);

		const response = await patchItem(createContext(request, itemParams()));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			item: { ...publicItem, caption: 'Brindis' },
		});
		expect(mockCaption).toHaveBeenCalledWith({
			space,
			session,
			mediaItemId: ITEM_ID,
			caption: 'Brindis',
		});
	});
});

describe('DELETE /api/memories/[slug]/items/[itemId]', () => {
	it('deletes the item and returns success', async () => {
		mockDelete.mockResolvedValue(undefined);
		const request = createMockRequest(undefined, undefined, `${ITEMS_URL}/${ITEM_ID}`);

		const response = await deleteItem(createContext(request, itemParams()));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ success: true });
		expect(mockGuestContext).toHaveBeenCalledWith(request, itemParams(), 'mutate');
		expect(mockDelete).toHaveBeenCalledWith({ space, session, mediaItemId: ITEM_ID });
	});
});
