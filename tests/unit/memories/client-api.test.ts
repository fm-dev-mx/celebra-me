import { dashboardApi } from '@/lib/dashboard/api-client';
import {
	MemoriesRequestError,
	buildOrganizerCatalogUrl,
	createMemoriesGuestApi,
	memoriesOrganizerApi,
} from '@/lib/memories/client/api';
import { partitionMemoriesExport, type ExportableMediaItem } from '@/lib/memories/client/export';
import { mapRequestIssue, memoriesIssueCopy } from '@/lib/memories/client/media-prep';
import { zonedDayBounds } from '@/lib/memories/client/zoned-date';
import type { MemoriesMediaPublicItem } from '@/lib/memories/contract/catalog';
import {
	MEMORIES_ARCHIVE_MAX_BYTES,
	MEMORIES_ARCHIVE_MAX_FILES,
} from '@/lib/memories/contract/limits';
import { memoriesCaptureCopy } from '@/lib/memories/copy';

jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedDashboardApi = dashboardApi as jest.Mocked<typeof dashboardApi>;

function jsonResponse(payload: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => payload,
	} as Response;
}

const PUBLIC_ITEM: MemoriesMediaPublicItem = {
	id: 'item-1',
	mimeType: 'image/jpeg',
	sizeBytes: 1024,
	durationSeconds: null,
	caption: '',
	status: 'accepted',
	createdAt: '2026-10-31T02:00:00.000Z',
	updatedAt: '2026-10-31T02:00:00.000Z',
	acceptedAt: '2026-10-31T02:00:00.000Z',
	rejectedAt: null,
	deletedAt: null,
};

function exportItem(id: string, sizeBytes: number): ExportableMediaItem {
	return { id, mimeType: 'image/jpeg', sizeBytes, createdAt: '2026-10-31T02:00:00.000Z' };
}

describe('memories client api', () => {
	beforeEach(() => {
		// The global fetch stub from tests/setup.ts keeps its call history across tests.
		(globalThis.fetch as jest.Mock).mockClear();
		mockedDashboardApi.get.mockReset();
		mockedDashboardApi.post.mockReset();
		mockedDashboardApi.patch.mockReset();
		mockedDashboardApi.delete.mockReset();
	});

	describe('createMemoriesGuestApi', () => {
		it('derives same-origin guest URLs from the public slug', () => {
			const api = createMemoriesGuestApi('slug');
			expect(api.itemsUrl).toBe('/api/memories/slug/items');
			expect(api.itemMediaUrl('item 1')).toBe('/api/memories/slug/items/item%201');
		});

		it('sends JSON requests with the Accept header and a JSON body only when needed', async () => {
			const fetchMock = jest
				.spyOn(globalThis, 'fetch')
				.mockResolvedValueOnce(jsonResponse({ profile: null }))
				.mockResolvedValueOnce(
					jsonResponse({
						profile: { displayName: 'Tía Ana', expiresAt: '2027-01-30T06:00:00.000Z' },
						recoveryCode: 'ABCD-EFGH-JKLM',
					}),
				);
			const api = createMemoriesGuestApi('slug');

			await expect(api.getSession()).resolves.toBeNull();
			expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/memories/slug/session', {
				headers: { Accept: 'application/json' },
			});

			await expect(api.createSession('Tía Ana')).resolves.toEqual({
				profile: { displayName: 'Tía Ana', expiresAt: '2027-01-30T06:00:00.000Z' },
				recoveryCode: 'ABCD-EFGH-JKLM',
			});
			const [url, init] = fetchMock.mock.calls[1];
			expect(url).toBe('/api/memories/slug/session');
			expect(init).toMatchObject({
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			});
			expect(JSON.parse(String((init as RequestInit).body))).toEqual({
				action: 'create',
				displayName: 'Tía Ana',
			});
		});

		it('turns HTTP failures into MemoriesRequestError with status and error code', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue(
				jsonResponse({ error: { code: 'rate_limited' } }, 429),
			);
			const api = createMemoriesGuestApi('slug');

			const failure = api.listItems();
			await expect(failure).rejects.toBeInstanceOf(MemoriesRequestError);
			await expect(failure).rejects.toMatchObject({
				name: 'MemoriesRequestError',
				status: 429,
				code: 'rate_limited',
			});
		});

		it('carries the refusal cause the server names in error.details', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue(
				jsonResponse(
					{ error: { code: 'limit_reached', details: { reason: 'session_videos' } } },
					409,
				),
			);

			await expect(createMemoriesGuestApi('slug').listItems()).rejects.toMatchObject({
				status: 409,
				code: 'limit_reached',
				reason: 'session_videos',
			});
		});

		it('reports a null status when the network request itself fails', async () => {
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
			const api = createMemoriesGuestApi('slug');

			await expect(
				api.reserve({
					mimeType: 'image/jpeg',
					sizeBytes: 4,
					checksumSha256: 'ab'.repeat(32),
					durationSeconds: undefined,
					clientRequestId: 'request-1',
				}),
			).rejects.toMatchObject({ status: null, code: undefined });
		});

		it('treats a non-JSON success body as a failed request', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => {
					throw new SyntaxError('Unexpected token');
				},
			} as unknown as Response);
			const api = createMemoriesGuestApi('slug');

			await expect(api.complete('item-1')).rejects.toMatchObject({ status: 200 });
		});
	});

	describe('buildOrganizerCatalogUrl', () => {
		it('omits empty filters and the "all" status', () => {
			const built = buildOrganizerCatalogUrl('event-1', 2, {
				status: 'all',
				uploader: '   ',
				createdFrom: '',
				createdTo: '',
			});
			expect(built).toBe('/api/dashboard/memories/event-1?page=2');
		});

		it('serializes active filters with a normalized uploader', () => {
			const built = buildOrganizerCatalogUrl('event-1', 0, {
				status: 'accepted',
				uploader: '  Tía   Ana  ',
				createdFrom: '2026-10-30T07:00:00.000Z',
				createdTo: '2026-10-31T07:00:00.000Z',
			});
			const url = new URL(built, 'https://celebra.test');
			expect(url.pathname).toBe('/api/dashboard/memories/event-1');
			expect(url.searchParams.get('page')).toBe('0');
			expect(url.searchParams.get('status')).toBe('accepted');
			expect(url.searchParams.get('uploader')).toBe('Tía Ana');
			expect(url.searchParams.get('createdFrom')).toBe('2026-10-30T07:00:00.000Z');
			expect(url.searchParams.get('createdTo')).toBe('2026-10-31T07:00:00.000Z');
		});
	});

	describe('memoriesOrganizerApi', () => {
		it('updates an item through dashboardApi.patch and unwraps the payload', async () => {
			const fetchMock = jest.spyOn(globalThis, 'fetch');
			mockedDashboardApi.patch.mockResolvedValue({
				ok: true,
				status: 200,
				data: { item: { ...PUBLIC_ITEM, status: 'rejected' } },
			});

			const updated = await memoriesOrganizerApi.updateItem('event-1', 'item 1', {
				status: 'rejected',
			});

			expect(mockedDashboardApi.patch).toHaveBeenCalledTimes(1);
			expect(mockedDashboardApi.patch).toHaveBeenCalledWith(
				'/api/dashboard/memories/event-1/items/item%201',
				{ status: 'rejected' },
			);
			expect(updated.status).toBe('rejected');
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('rejects with MemoriesRequestError when the dashboard client reports a failure', async () => {
			mockedDashboardApi.patch.mockResolvedValue({
				ok: false,
				status: 403,
				code: 'forbidden',
				message: 'No autorizado',
			});

			const failure = memoriesOrganizerApi.updateItem('event-1', 'item-1', { caption: 'x' });
			await expect(failure).rejects.toBeInstanceOf(MemoriesRequestError);
			await expect(failure).rejects.toMatchObject({ status: 403, code: 'forbidden' });
		});

		it('routes delete and revoke mutations through the dashboard client', async () => {
			mockedDashboardApi.delete.mockResolvedValue({
				ok: true,
				status: 200,
				data: { success: true },
			});
			mockedDashboardApi.post.mockResolvedValue({
				ok: true,
				status: 200,
				data: { success: true },
			});

			await memoriesOrganizerApi.deleteItem('event-1', 'item-1');
			await memoriesOrganizerApi.revokeUploader('event-1', 'invitado-a1b2c3d4');

			expect(mockedDashboardApi.delete).toHaveBeenCalledWith(
				'/api/dashboard/memories/event-1/items/item-1',
			);
			expect(mockedDashboardApi.post).toHaveBeenCalledWith(
				'/api/dashboard/memories/event-1',
				{
					action: 'revoke_session',
					guestAlias: 'invitado-a1b2c3d4',
				},
			);
		});

		it('lists the catalog through dashboardApi.get with the abort signal', async () => {
			mockedDashboardApi.get.mockResolvedValue({
				ok: true,
				status: 200,
				data: { items: [], nextPage: null },
			});
			const controller = new AbortController();

			await memoriesOrganizerApi.listItems(
				'event-1',
				1,
				{ status: 'accepted', uploader: '' },
				controller.signal,
			);

			expect(mockedDashboardApi.get).toHaveBeenCalledWith(
				'/api/dashboard/memories/event-1?page=1&status=accepted',
				{ signal: controller.signal },
			);
		});

		it('builds media URLs with an optional preview mode', () => {
			expect(memoriesOrganizerApi.itemMediaUrl('event-1', 'item-1')).toBe(
				'/api/dashboard/memories/event-1/items/item-1',
			);
			expect(memoriesOrganizerApi.itemMediaUrl('event-1', 'item-1', 'preview')).toBe(
				'/api/dashboard/memories/event-1/items/item-1?mode=preview',
			);
		});
	});

	describe('zonedDayBounds', () => {
		it('returns the UTC bounds of a local calendar day in the event time zone', () => {
			expect(zonedDayBounds('2026-10-30', 'America/Mazatlan')).toEqual({
				createdFrom: '2026-10-30T07:00:00.000Z',
				createdTo: '2026-10-31T07:00:00.000Z',
			});
		});

		it('crosses month and year boundaries correctly', () => {
			expect(zonedDayBounds('2026-12-31', 'America/Mexico_City')).toEqual({
				createdFrom: '2026-12-31T06:00:00.000Z',
				createdTo: '2027-01-01T06:00:00.000Z',
			});
		});

		it('returns null for malformed input', () => {
			expect(zonedDayBounds('30/10/2026', 'America/Mazatlan')).toBeNull();
			expect(zonedDayBounds('', 'America/Mazatlan')).toBeNull();
			expect(zonedDayBounds('2026-10-30T00:00', 'America/Mazatlan')).toBeNull();
		});
	});

	describe('partitionMemoriesExport', () => {
		it('splits batches by the archive file count', () => {
			const items = Array.from({ length: MEMORIES_ARCHIVE_MAX_FILES * 2 + 5 }, (_, index) =>
				exportItem(`item-${index}`, 1),
			);

			const batches = partitionMemoriesExport(items);

			expect(batches.map((batch) => batch.length)).toEqual([
				MEMORIES_ARCHIVE_MAX_FILES,
				MEMORIES_ARCHIVE_MAX_FILES,
				5,
			]);
			expect(batches.flat()).toEqual(items);
		});

		it('splits batches by the archive byte budget', () => {
			const half = MEMORIES_ARCHIVE_MAX_BYTES / 2;
			const items = [exportItem('a', half), exportItem('b', half), exportItem('c', 1)];

			const batches = partitionMemoriesExport(items);

			expect(batches.map((batch) => batch.map((item) => item.id))).toEqual([
				['a', 'b'],
				['c'],
			]);
		});

		it('throws when a single file exceeds the archive budget', () => {
			expect(() =>
				partitionMemoriesExport([exportItem('big', MEMORIES_ARCHIVE_MAX_BYTES + 1)]),
			).toThrow('Un archivo individual supera el límite del lote cifrado.');
		});

		it('returns no batches for an empty selection', () => {
			expect(partitionMemoriesExport([])).toEqual([]);
		});
	});

	describe('mapRequestIssue', () => {
		it.each([
			['429 without code', new MemoriesRequestError(429), 'rate_limited'],
			['rate_limited code', new MemoriesRequestError(400, 'rate_limited'), 'rate_limited'],
			['limit_reached code', new MemoriesRequestError(409, 'limit_reached'), 'quota_reached'],
			['403', new MemoriesRequestError(403), 'window_closed'],
			['404', new MemoriesRequestError(404), 'unavailable'],
			['503', new MemoriesRequestError(503), 'unavailable'],
			['500', new MemoriesRequestError(500), 'sign_failed'],
			['401', new MemoriesRequestError(401, 'unauthorized'), 'session_lost'],
			['409 conflict', new MemoriesRequestError(409, 'conflict'), 'upload_expired'],
			[
				'the file quota cause',
				new MemoriesRequestError(409, 'limit_reached', 'session_files'),
				'session_files_reached',
			],
			[
				'the video quota cause',
				new MemoriesRequestError(409, 'limit_reached', 'session_videos'),
				'session_videos_reached',
			],
			[
				'the per-guest storage cause',
				new MemoriesRequestError(409, 'limit_reached', 'session_bytes'),
				'session_bytes_reached',
			],
			[
				'the event capacity cause',
				new MemoriesRequestError(409, 'limit_reached', 'event_capacity'),
				'event_full',
			],
			[
				'uploads still in progress, ahead of the plain 429',
				new MemoriesRequestError(429, 'rate_limited', 'uploads_in_progress'),
				'uploads_in_progress',
			],
			[
				'an unknown cause, by its code',
				new MemoriesRequestError(409, 'limit_reached', 'toString'),
				'quota_reached',
			],
		] as const)('maps %s', (_label, error, expected) => {
			expect(mapRequestIssue(error, 'sign_failed')).toBe(expected);
		});

		it('falls back to the caller issue for non-API errors while online', () => {
			jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
			expect(mapRequestIssue(new Error('boom'), 'put_failed')).toBe('put_failed');
			expect(mapRequestIssue(new MemoriesRequestError(null), 'sign_failed')).toBe(
				'sign_failed',
			);
		});

		it('reports network_failed when the browser is offline', () => {
			jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
			expect(mapRequestIssue(new MemoriesRequestError(null), 'sign_failed')).toBe(
				'network_failed',
			);
			expect(mapRequestIssue(new TypeError('Failed to fetch'), 'put_failed')).toBe(
				'network_failed',
			);
		});

		it('resolves guest-facing copy for every mapped issue', () => {
			expect(memoriesIssueCopy('rate_limited')).toBe(memoriesCaptureCopy.rateLimited);
			expect(memoriesIssueCopy('quota_reached')).toBe(memoriesCaptureCopy.quotaReached);
			expect(memoriesIssueCopy('window_closed')).toBe(memoriesCaptureCopy.windowClosed);
			expect(memoriesIssueCopy('unavailable')).toBe(memoriesCaptureCopy.unavailable);
			expect(memoriesIssueCopy('network_failed')).toBe(memoriesCaptureCopy.networkFailed);
		});
	});
});
