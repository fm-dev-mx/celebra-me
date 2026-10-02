jest.mock('@/lib/memories/server/catalog.repository', () => ({
	findMediaById: jest.fn(),
	listOrganizerMedia: jest.fn(),
	patchMedia: jest.fn(),
	revokeSessionsByAlias: jest.fn(),
}));

jest.mock('@/lib/memories/server/settings.repository', () => ({
	findMemorySpaceByEventId: jest.fn(),
	listMemorySpacesByEventIds: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rsvp/services/shared/event-owner-access', () => ({
	getEventOwnerAccessOrThrow: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/role-membership.repository', () => ({
	listMembershipsForHost: jest.fn(),
}));

import type { EventMembershipRecord } from '@/interfaces/auth/session.interface';
import { MEMORIES_CATALOG_PAGE_SIZE } from '@/lib/memories/contract/limits';
import { ApiError } from '@/lib/rsvp/core/errors';
import { listMembershipsForHost } from '@/lib/rsvp/repositories/role-membership.repository';
import { getEventOwnerAccessOrThrow } from '@/lib/rsvp/services/shared/event-owner-access';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import {
	findMediaById,
	listOrganizerMedia,
	patchMedia,
	revokeSessionsByAlias,
	type OrganizerMediaRow,
} from '@/lib/memories/server/catalog.repository';
import {
	listOrganizerMemoryItems,
	listOrganizerMemorySpaces,
	organizerMaxPage,
	requireOrganizerMemorySpace,
	revokeGuestMemorySession,
	updateOrganizerMemoryItem,
} from '@/lib/memories/server/organizer.service';
import {
	findMemorySpaceByEventId,
	listMemorySpacesByEventIds,
} from '@/lib/memories/server/settings.repository';
import {
	EVENT_ID,
	GUEST_ALIAS,
	ITEM_ID,
	OWNER_USER_ID,
	buildMediaRow,
	buildSessionRow,
	buildSpace,
} from './fixtures';

const mockMemberships = listMembershipsForHost as jest.MockedFunction<
	typeof listMembershipsForHost
>;
const mockListSpaces = listMemorySpacesByEventIds as jest.MockedFunction<
	typeof listMemorySpacesByEventIds
>;
const mockFindSpace = findMemorySpaceByEventId as jest.MockedFunction<
	typeof findMemorySpaceByEventId
>;
const mockOwnerAccess = getEventOwnerAccessOrThrow as jest.MockedFunction<
	typeof getEventOwnerAccessOrThrow
>;
const mockListMedia = listOrganizerMedia as jest.MockedFunction<typeof listOrganizerMedia>;
const mockFindMedia = findMediaById as jest.MockedFunction<typeof findMediaById>;
const mockPatch = patchMedia as jest.MockedFunction<typeof patchMedia>;
const mockRevoke = revokeSessionsByAlias as jest.MockedFunction<typeof revokeSessionsByAlias>;
const mockAudit = appendMemoriesAudit as jest.MockedFunction<typeof appendMemoriesAudit>;

const space = buildSpace();
const hostSession = { userId: OWNER_USER_ID, accessToken: 'host-access-token' };

const OWNED_EVENT_A = 'e0000000-0000-4000-8000-0000000000a1';
const MANAGED_EVENT = 'e0000000-0000-4000-8000-0000000000a2';
const OWNED_EVENT_B = 'e0000000-0000-4000-8000-0000000000a3';

function membership(eventId: string, membershipRole: 'owner' | 'manager'): EventMembershipRecord {
	return {
		id: `m-${eventId.slice(-2)}`,
		eventId,
		userId: OWNER_USER_ID,
		membershipRole,
		createdAt: '2026-09-01T00:00:00.000Z',
		updatedAt: '2026-09-01T00:00:00.000Z',
	};
}

function organizerRow(
	index: number,
	status: OrganizerMediaRow['status'] = 'accepted',
): OrganizerMediaRow {
	return {
		...buildMediaRow({
			id: `b0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
			status,
		}),
		uploader: { display_name: 'Tía Ana', guest_alias: GUEST_ALIAS },
	};
}

describe('listOrganizerMemorySpaces', () => {
	beforeEach(() => jest.clearAllMocks());

	it('only queries spaces for events where the host is an owner', async () => {
		mockMemberships.mockResolvedValue([
			membership(OWNED_EVENT_A, 'owner'),
			membership(MANAGED_EVENT, 'manager'),
			membership(OWNED_EVENT_B, 'owner'),
		]);
		const spaces = [buildSpace({ eventId: OWNED_EVENT_A })];
		mockListSpaces.mockResolvedValue(spaces);

		await expect(listOrganizerMemorySpaces({ accessToken: 'host-access-token' })).resolves.toBe(
			spaces,
		);

		expect(mockMemberships).toHaveBeenCalledWith('host-access-token');
		expect(mockListSpaces).toHaveBeenCalledWith([OWNED_EVENT_A, OWNED_EVENT_B]);
	});

	it('passes an empty list when the host owns nothing', async () => {
		mockMemberships.mockResolvedValue([membership(MANAGED_EVENT, 'manager')]);
		mockListSpaces.mockResolvedValue([]);
		await listOrganizerMemorySpaces({ accessToken: 'host-access-token' });
		expect(mockListSpaces).toHaveBeenCalledWith([]);
	});
});

describe('requireOrganizerMemorySpace', () => {
	beforeEach(() => jest.clearAllMocks());

	it('checks owner access before resolving the space', async () => {
		mockOwnerAccess.mockResolvedValue({ id: EVENT_ID } as never);
		mockFindSpace.mockResolvedValue(space);
		await expect(requireOrganizerMemorySpace(EVENT_ID, hostSession)).resolves.toBe(space);
		expect(mockOwnerAccess).toHaveBeenCalledWith(EVENT_ID, hostSession);
		expect(mockOwnerAccess.mock.invocationCallOrder[0]).toBeLessThan(
			mockFindSpace.mock.invocationCallOrder[0],
		);
	});

	it('propagates the owner access failure without touching settings', async () => {
		mockOwnerAccess.mockRejectedValue(new ApiError(403, 'forbidden', 'No autorizado.'));
		await expect(requireOrganizerMemorySpace(EVENT_ID, hostSession)).rejects.toMatchObject({
			status: 403,
		});
		expect(mockFindSpace).not.toHaveBeenCalled();
	});

	it('returns 404 when the owned event has no memory space', async () => {
		mockOwnerAccess.mockResolvedValue({ id: EVENT_ID } as never);
		mockFindSpace.mockResolvedValue(null);
		await expect(requireOrganizerMemorySpace(EVENT_ID, hostSession)).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});
});

describe('listOrganizerMemoryItems', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockListMedia.mockResolvedValue([]);
	});

	it('derives the maximum page from the event object quota', () => {
		expect(organizerMaxPage(space)).toBe(29);
		expect(organizerMaxPage(buildSpace({ maxEventObjects: 50 }))).toBe(0);
		expect(organizerMaxPage(buildSpace({ maxEventObjects: 51 }))).toBe(1);
	});

	it.each([organizerMaxPage(space) + 1, -1, 1.5, Number.NaN])(
		'rejects page %p with a 400 before querying',
		async (page) => {
			await expect(listOrganizerMemoryItems(space, { page })).rejects.toMatchObject({
				status: 400,
				code: 'bad_request',
			});
			expect(mockListMedia).not.toHaveBeenCalled();
		},
	);

	it('accepts the last valid page', async () => {
		await expect(
			listOrganizerMemoryItems(space, { page: organizerMaxPage(space) }),
		).resolves.toEqual({ items: [], nextPage: null });
	});

	it.each(['deleted', 'bogus'])('rejects the %s status filter', async (status) => {
		await expect(
			listOrganizerMemoryItems(space, { status: status as never }),
		).rejects.toMatchObject({ status: 400 });
		expect(mockListMedia).not.toHaveBeenCalled();
	});

	it('rejects malformed and inverted date bounds', async () => {
		await expect(
			listOrganizerMemoryItems(space, { createdFrom: '2026-10-24' }),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			listOrganizerMemoryItems(space, { createdTo: 'not-a-date' }),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			listOrganizerMemoryItems(space, {
				createdFrom: '2026-10-25T00:00:00.000Z',
				createdTo: '2026-10-24T00:00:00.000Z',
			}),
		).rejects.toMatchObject({ status: 400 });
		expect(mockListMedia).not.toHaveBeenCalled();
	});

	it('rejects uploader filters with markup or excessive length', async () => {
		await expect(
			listOrganizerMemoryItems(space, { uploader: '<script>' }),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			listOrganizerMemoryItems(space, { uploader: 'a'.repeat(61) }),
		).rejects.toMatchObject({ status: 400 });
		expect(mockListMedia).not.toHaveBeenCalled();
	});

	it('requests one row beyond the page size and reports the next page', async () => {
		mockListMedia.mockResolvedValue(
			Array.from({ length: MEMORIES_CATALOG_PAGE_SIZE + 1 }, (_, index) =>
				organizerRow(index + 1),
			),
		);

		const result = await listOrganizerMemoryItems(space, {
			page: 2,
			status: 'accepted',
			uploader: '  Tía   Ana ',
			createdFrom: '2026-10-24T00:00:00.000Z',
			createdTo: '2026-10-25T00:00:00.000Z',
		});

		expect(mockListMedia).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			limit: MEMORIES_CATALOG_PAGE_SIZE + 1,
			offset: 2 * MEMORIES_CATALOG_PAGE_SIZE,
			status: 'accepted',
			uploader: 'Tía Ana',
			createdFrom: '2026-10-24T00:00:00.000Z',
			createdTo: '2026-10-25T00:00:00.000Z',
		});
		expect(result.items).toHaveLength(MEMORIES_CATALOG_PAGE_SIZE);
		expect(result.nextPage).toBe(3);
		expect(result.items[0]).toMatchObject({
			uploader: { displayName: 'Tía Ana', guestAlias: GUEST_ALIAS },
		});
		expect(result.items[0]).not.toHaveProperty('objectKey');
	});

	it('returns no next page when the batch fits in one page', async () => {
		mockListMedia.mockResolvedValue([organizerRow(1), organizerRow(2)]);
		const result = await listOrganizerMemoryItems(space);
		expect(result.items).toHaveLength(2);
		expect(result.nextPage).toBeNull();
		expect(mockListMedia).toHaveBeenCalledWith(
			expect.objectContaining({ offset: 0, status: undefined, uploader: undefined }),
		);
	});
});

describe('updateOrganizerMemoryItem', () => {
	beforeEach(() => jest.clearAllMocks());

	it('rejects forbidden transitions with a 409 before patching', async () => {
		mockFindMedia.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		await expect(
			updateOrganizerMemoryItem({
				space,
				mediaItemId: ITEM_ID,
				status: 'uploading',
				actorId: OWNER_USER_ID,
			}),
		).rejects.toMatchObject({ status: 409, code: 'conflict' });
		expect(mockPatch).not.toHaveBeenCalled();
	});

	it('rejects unknown statuses with a 400', async () => {
		mockFindMedia.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		await expect(
			updateOrganizerMemoryItem({
				space,
				mediaItemId: ITEM_ID,
				status: 'archived',
				actorId: OWNER_USER_ID,
			}),
		).rejects.toMatchObject({ status: 400 });
		expect(mockPatch).not.toHaveBeenCalled();
	});

	it('returns 404 for unknown items', async () => {
		mockFindMedia.mockResolvedValue(null);
		await expect(
			updateOrganizerMemoryItem({
				space,
				mediaItemId: ITEM_ID,
				status: 'deleted',
				actorId: OWNER_USER_ID,
			}),
		).rejects.toMatchObject({ status: 404 });
	});

	it('sets deleted_at and cleanup_after when deleting', async () => {
		mockFindMedia.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'deleted' }));

		const item = await updateOrganizerMemoryItem({
			space,
			mediaItemId: ITEM_ID,
			status: 'deleted',
			actorId: OWNER_USER_ID,
		});

		const [itemId, body] = mockPatch.mock.calls[0];
		expect(itemId).toBe(ITEM_ID);
		expect(body.status).toBe('deleted');
		expect(typeof body.deleted_at).toBe('string');
		expect(body.cleanup_after).toBe(body.deleted_at);
		expect(body.accepted_at).toBeNull();
		expect(body.rejected_at).toBeNull();
		expect(item.status).toBe('deleted');
		expect(mockAudit).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			mediaItemId: ITEM_ID,
			actorType: 'organizer',
			actorId: OWNER_USER_ID,
			action: 'moderation_updated',
			metadata: { fromStatus: 'accepted', toStatus: 'deleted' },
		});
	});

	it('sets rejected_at and cleanup_after when rejecting', async () => {
		mockFindMedia.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'rejected' }));

		await updateOrganizerMemoryItem({
			space,
			mediaItemId: ITEM_ID,
			status: 'rejected',
			actorId: OWNER_USER_ID,
		});

		const body = mockPatch.mock.calls[0][1];
		expect(body.status).toBe('rejected');
		expect(typeof body.rejected_at).toBe('string');
		expect(body.cleanup_after).toBe(body.rejected_at);
		expect(body.deleted_at).toBeNull();
	});

	it('updates only the caption when the status is unchanged', async () => {
		mockFindMedia.mockResolvedValue(buildMediaRow({ status: 'accepted' }));
		mockPatch.mockResolvedValue(buildMediaRow({ status: 'accepted', caption: 'Brindis' }));

		const item = await updateOrganizerMemoryItem({
			space,
			mediaItemId: ITEM_ID,
			caption: ' Brindis ',
			actorId: OWNER_USER_ID,
		});

		expect(mockPatch).toHaveBeenCalledWith(ITEM_ID, { caption: 'Brindis' });
		expect(item.caption).toBe('Brindis');
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'caption_updated' }),
		);
	});
});

describe('revokeGuestMemorySession', () => {
	beforeEach(() => jest.clearAllMocks());

	it.each(['Invitado-3f9a1c7e', 'invitado-3f9a', 'invitado-3F9A1C7E', '', 42])(
		'rejects the alias %p with a 400 without touching sessions',
		async (guestAlias) => {
			await expect(
				revokeGuestMemorySession({ space, guestAlias, actorId: OWNER_USER_ID }),
			).rejects.toMatchObject({ status: 400, code: 'bad_request' });
			expect(mockRevoke).not.toHaveBeenCalled();
		},
	);

	it('returns 404 when no active session matches the alias', async () => {
		mockRevoke.mockResolvedValue([]);
		await expect(
			revokeGuestMemorySession({
				space,
				guestAlias: ` ${GUEST_ALIAS} `,
				actorId: OWNER_USER_ID,
			}),
		).rejects.toMatchObject({ status: 404, code: 'not_found' });
		expect(mockRevoke).toHaveBeenCalledWith(EVENT_ID, GUEST_ALIAS);
		expect(mockAudit).not.toHaveBeenCalled();
	});

	it('audits a successful revocation without naming the guest', async () => {
		mockRevoke.mockResolvedValue([buildSessionRow({ revoked_at: '2026-10-24T12:00:00.000Z' })]);
		await expect(
			revokeGuestMemorySession({ space, guestAlias: GUEST_ALIAS, actorId: OWNER_USER_ID }),
		).resolves.toBeUndefined();
		expect(mockAudit).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			actorType: 'organizer',
			actorId: OWNER_USER_ID,
			action: 'guest_session_revoked',
		});
		expect(JSON.stringify(mockAudit.mock.calls[0][0])).not.toContain(GUEST_ALIAS);
	});
});
