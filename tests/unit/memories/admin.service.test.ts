jest.mock('@/lib/memories/server/settings.repository', () => ({
	findMemorySpaceByEventId: jest.fn(),
	insertMemorySpace: jest.fn(),
	listAllMemorySpaces: jest.fn(),
	updateMemorySpace: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventByIdService: jest.fn(),
	listAllEventsService: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import {
	createMemorySpaceAdmin,
	listMemorySpaceCandidatesAdmin,
	updateMemorySpaceAdmin,
	type MemorySpaceCreateInput,
} from '@/lib/memories/server/admin.service';
import {
	findMemorySpaceByEventId,
	insertMemorySpace,
	listAllMemorySpaces,
	updateMemorySpace,
} from '@/lib/memories/server/settings.repository';
import {
	findEventByIdService,
	listAllEventsService,
} from '@/lib/rsvp/repositories/event.repository';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { ADMIN_USER_ID, EVENT_ID, OWNER_USER_ID, PUBLIC_SLUG, buildSpace } from './fixtures';

const mockInsert = insertMemorySpace as jest.MockedFunction<typeof insertMemorySpace>;
const mockFindSpace = findMemorySpaceByEventId as jest.MockedFunction<
	typeof findMemorySpaceByEventId
>;
const mockListSpaces = listAllMemorySpaces as jest.MockedFunction<typeof listAllMemorySpaces>;
const mockUpdate = updateMemorySpace as jest.MockedFunction<typeof updateMemorySpace>;
const mockFindEvent = findEventByIdService as jest.MockedFunction<typeof findEventByIdService>;
const mockListEvents = listAllEventsService as jest.MockedFunction<typeof listAllEventsService>;
const mockFindPublished = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;
const mockAudit = appendMemoriesAudit as jest.MockedFunction<typeof appendMemoriesAudit>;

const INVITATION_ID = '10000000-0000-4000-8000-000000000001';
const EVENT_WITH_SPACE = 'e0000000-0000-4000-8000-0000000000b2';
const DRAFT_EVENT = 'e0000000-0000-4000-8000-0000000000b3';
const EVENT_WITHOUT_INVITATION = 'e0000000-0000-4000-8000-0000000000b4';

function buildEvent(overrides: Partial<EventRecord> = {}): EventRecord {
	return {
		id: EVENT_ID,
		ownerUserId: OWNER_USER_ID,
		slug: PUBLIC_SLUG,
		eventType: 'boda',
		title: 'Victoria y Roberto',
		status: 'published',
		publishedAt: '2026-09-01T00:00:00.000Z',
		invitationId: INVITATION_ID,
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-09-01T00:00:00.000Z',
		...overrides,
	};
}

function createPayload(overrides: Partial<MemorySpaceCreateInput> = {}): MemorySpaceCreateInput {
	return {
		eventId: EVENT_ID,
		publicSlug: PUBLIC_SLUG,
		timeZone: 'America/Mazatlan',
		uploadStartsLocal: '2026-10-23T00:00',
		uploadEndsLocal: '2026-11-01T00:00',
		retentionEndsLocal: '2026-12-30T00:00',
		entitlement: 'package',
		limits: { ...MEMORIES_LIMIT_PROFILES.standard },
		...overrides,
	};
}

describe('createMemorySpaceAdmin', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockFindEvent.mockResolvedValue(buildEvent());
		mockInsert.mockResolvedValue(buildSpace());
	});

	it.each([
		['a non-uuid event id', { eventId: 'evento-1' }],
		['an uppercase public slug', { publicSlug: 'Victoria-Y-Roberto' }],
		['a public slug with a trailing hyphen', { publicSlug: 'victoria-' }],
		['an invalid time zone', { timeZone: 'Mars/Olympus' }],
		['a local date without minutes', { uploadStartsLocal: '2026-10-23' }],
		['an unknown entitlement', { entitlement: 'gift' as never }],
		[
			'non-integer limits',
			{ limits: { ...MEMORIES_LIMIT_PROFILES.standard, maxSessionFiles: 1.5 } },
		],
	])('rejects %s with a validation error before any lookup', async (_label, overrides) => {
		await expect(
			createMemorySpaceAdmin(createPayload(overrides), ADMIN_USER_ID),
		).rejects.toMatchObject({
			status: 400,
			code: 'validation_error',
		});
		expect(mockFindEvent).not.toHaveBeenCalled();
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it.each([
		['the window ends before it starts', { uploadEndsLocal: '2026-10-22T00:00' }],
		['the window ends when it starts', { uploadEndsLocal: '2026-10-23T00:00' }],
		['retention ends before the window closes', { retentionEndsLocal: '2026-10-31T00:00' }],
		['retention exceeds 150 days from the opening', { retentionEndsLocal: '2027-03-23T00:00' }],
	])('rejects a schedule where %s without persisting', async (_label, overrides) => {
		await expect(
			createMemorySpaceAdmin(createPayload(overrides), ADMIN_USER_ID),
		).rejects.toMatchObject({
			status: 400,
			code: 'validation_error',
		});
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('accepts a retention of exactly 150 days from the opening', async () => {
		await expect(
			createMemorySpaceAdmin(
				createPayload({ retentionEndsLocal: '2027-03-22T00:00' }),
				ADMIN_USER_ID,
			),
		).resolves.toBeDefined();
		expect(mockInsert).toHaveBeenCalledTimes(1);
	});

	it('rejects unpublished events with a 409', async () => {
		mockFindEvent.mockResolvedValue(buildEvent({ status: 'draft', publishedAt: null }));
		await expect(createMemorySpaceAdmin(createPayload(), ADMIN_USER_ID)).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('rejects unknown events with a 404', async () => {
		mockFindEvent.mockResolvedValue(null);
		await expect(createMemorySpaceAdmin(createPayload(), ADMIN_USER_ID)).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('derives UTC instants from the local schedule in the given zone', async () => {
		const created = await createMemorySpaceAdmin(createPayload(), ADMIN_USER_ID);

		expect(mockInsert).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			publicSlug: PUBLIC_SLUG,
			enabled: true,
			timeZone: 'America/Mazatlan',
			uploadStartsAt: '2026-10-23T07:00:00.000Z',
			uploadEndsAt: '2026-11-01T07:00:00.000Z',
			retentionEndsAt: '2026-12-30T07:00:00.000Z',
			...MEMORIES_LIMIT_PROFILES.standard,
			entitlement: 'package',
			createdBy: ADMIN_USER_ID,
		});
		expect(created).toEqual(buildSpace());
		expect(mockAudit).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			actorType: 'admin',
			actorId: ADMIN_USER_ID,
			action: 'space_created',
			metadata: { entitlement: 'package' },
		});
	});

	it('honours a different zone when deriving instants', async () => {
		await createMemorySpaceAdmin(
			createPayload({ timeZone: 'America/Mexico_City' }),
			ADMIN_USER_ID,
		);
		expect(mockInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				timeZone: 'America/Mexico_City',
				uploadStartsAt: '2026-10-23T06:00:00.000Z',
			}),
		);
	});

	it('defaults the public slug to the event slug', async () => {
		mockFindEvent.mockResolvedValue(buildEvent({ slug: 'boda-victoria-roberto' }));
		await createMemorySpaceAdmin(createPayload({ publicSlug: undefined }), ADMIN_USER_ID);
		expect(mockInsert).toHaveBeenCalledWith(
			expect.objectContaining({ publicSlug: 'boda-victoria-roberto' }),
		);
	});

	it('maps a unique violation to a 409 conflict', async () => {
		mockInsert.mockRejectedValue(
			new SupabaseHttpError(409, '{"code":"23505","message":"duplicate key"}', '23505'),
		);
		await expect(createMemorySpaceAdmin(createPayload(), ADMIN_USER_ID)).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});
		expect(mockAudit).not.toHaveBeenCalled();
	});

	it('maps a check violation to a validation error', async () => {
		mockInsert.mockRejectedValue(
			new SupabaseHttpError(400, '{"code":"23514","message":"check constraint"}', '23514'),
		);
		await expect(createMemorySpaceAdmin(createPayload(), ADMIN_USER_ID)).rejects.toMatchObject({
			status: 400,
			code: 'validation_error',
		});
	});

	it('rethrows other persistence errors', async () => {
		const error = new SupabaseHttpError(500, 'boom', null);
		mockInsert.mockRejectedValue(error);
		await expect(createMemorySpaceAdmin(createPayload(), ADMIN_USER_ID)).rejects.toBe(error);
	});
});

describe('listMemorySpaceCandidatesAdmin', () => {
	beforeEach(() => jest.clearAllMocks());

	it('excludes events with a space or not published and derives defaults from timing', async () => {
		mockListEvents.mockResolvedValue([
			buildEvent(),
			buildEvent({ id: EVENT_WITH_SPACE, slug: 'ana-y-luis', title: 'Ana y Luis' }),
			buildEvent({ id: DRAFT_EVENT, slug: 'borrador', status: 'draft', publishedAt: null }),
			buildEvent({
				id: EVENT_WITHOUT_INVITATION,
				slug: 'sin-invitacion',
				invitationId: null,
			}),
		]);
		mockListSpaces.mockResolvedValue([buildSpace({ eventId: EVENT_WITH_SPACE })]);
		mockFindPublished.mockResolvedValue({
			id: '20000000-0000-4000-8000-000000000001',
			invitationId: INVITATION_ID,
			slug: PUBLIC_SLUG,
			eventType: 'boda',
			isDemo: false,
			content: {
				eventTiming: { localDateTime: '2026-10-30T17:00', timeZone: 'America/Mazatlan' },
			},
			version: 3,
			publishedAt: '2026-09-01T00:00:00.000Z',
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-09-01T00:00:00.000Z',
		});

		const candidates = await listMemorySpaceCandidatesAdmin();

		expect(candidates.map((candidate) => candidate.eventId)).toEqual([
			EVENT_ID,
			EVENT_WITHOUT_INVITATION,
		]);
		expect(mockFindPublished).toHaveBeenCalledTimes(1);
		expect(mockFindPublished).toHaveBeenCalledWith(INVITATION_ID);
		expect(candidates[0]).toEqual({
			eventId: EVENT_ID,
			eventSlug: PUBLIC_SLUG,
			eventTitle: 'Victoria y Roberto',
			defaults: {
				publicSlug: PUBLIC_SLUG,
				timeZone: 'America/Mazatlan',
				uploadStartsLocal: '2026-10-23T00:00',
				uploadEndsLocal: '2026-11-07T00:00',
				retentionEndsLocal: '2027-01-06T00:00',
				limits: MEMORIES_LIMIT_PROFILES.standard,
			},
		});
		expect(candidates[1].defaults).toMatchObject({
			publicSlug: 'sin-invitacion',
			timeZone: 'America/Chihuahua',
		});
		expect(candidates[1].defaults.uploadStartsLocal).toMatch(/^\d{4}-\d{2}-\d{2}T00:00$/);
	});

	it('returns nothing when every published event already has a space', async () => {
		mockListEvents.mockResolvedValue([buildEvent()]);
		mockListSpaces.mockResolvedValue([buildSpace()]);
		await expect(listMemorySpaceCandidatesAdmin()).resolves.toEqual([]);
		expect(mockFindPublished).not.toHaveBeenCalled();
	});
});

describe('updateMemorySpaceAdmin', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockFindSpace.mockResolvedValue(buildSpace());
		mockUpdate.mockResolvedValue(buildSpace({ enabled: false }));
	});

	it('returns 404 when the event has no space', async () => {
		mockFindSpace.mockResolvedValue(null);
		await expect(
			updateMemorySpaceAdmin(EVENT_ID, { enabled: false }, ADMIN_USER_ID),
		).rejects.toMatchObject({
			status: 404,
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it('keeps the stored schedule when only the flag changes', async () => {
		const updated = await updateMemorySpaceAdmin(EVENT_ID, { enabled: false }, ADMIN_USER_ID);
		expect(mockFindSpace).toHaveBeenCalledWith(EVENT_ID);
		expect(mockUpdate).toHaveBeenCalledWith(EVENT_ID, {
			uploadStartsAt: '2026-10-16T07:00:00.000Z',
			uploadEndsAt: '2026-10-31T07:00:00.000Z',
			retentionEndsAt: '2026-12-30T07:00:00.000Z',
			timeZone: 'America/Mazatlan',
			enabled: false,
		});
		expect(updated.enabled).toBe(false);
		expect(mockAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'space_updated', actorId: ADMIN_USER_ID }),
		);
	});

	it('re-derives instants for the provided local values and validates the schedule', async () => {
		await updateMemorySpaceAdmin(
			EVENT_ID,
			{ uploadEndsLocal: '2026-11-05T00:00', limits: MEMORIES_LIMIT_PROFILES.extended },
			ADMIN_USER_ID,
		);
		expect(mockUpdate).toHaveBeenCalledWith(
			EVENT_ID,
			expect.objectContaining({
				uploadEndsAt: '2026-11-05T07:00:00.000Z',
				...MEMORIES_LIMIT_PROFILES.extended,
			}),
		);
		await expect(
			updateMemorySpaceAdmin(
				EVENT_ID,
				{ uploadEndsLocal: '2026-10-01T00:00' },
				ADMIN_USER_ID,
			),
		).rejects.toMatchObject({ status: 400, code: 'validation_error' });
	});
});
