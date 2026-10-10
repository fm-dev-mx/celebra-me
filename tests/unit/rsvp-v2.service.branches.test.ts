import {
	createDashboardGuest,
	deleteDashboardGuest,
	listDashboardGuests,
	markGuestShared,
	updateDashboardGuest,
} from '@/lib/rsvp/services/dashboard-guests.service';
import { listHostEvents, listHostEventsWithDebug } from '@/lib/rsvp/services/event-admin.service';
import { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import {
	submitGuestRsvpByInviteId,
	submitGuestRsvpByPublicEvent,
	trackInvitationView,
} from '@/lib/rsvp/services/rsvp-submission.service';
import * as eventRepo from '@/lib/rsvp/repositories/event.repository';
import * as guestRepo from '@/lib/rsvp/repositories/guest.repository';
import * as membershipRepo from '@/lib/rsvp/repositories/role-membership.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';
import * as engagementRepo from '@/lib/rsvp/repositories/engagement.repository';

jest.mock('@/lib/rsvp/repositories/event.repository');
jest.mock('@/lib/rsvp/repositories/guest.repository');
jest.mock('@/lib/rsvp/repositories/role-membership.repository');
jest.mock('@/lib/rsvp/repositories/engagement.repository');
jest.mock('@/lib/rsvp/services/audit-logger.service', () => ({
	logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/rsvp/services/shared/invitation-helpers', () => ({
	...jest.requireActual('@/lib/rsvp/services/shared/invitation-helpers'),
	getSharingConfigForSlug: jest.fn().mockResolvedValue({}),
}));

describe('rsvp service branches', () => {
	const findEventByIdMock = eventRepo.findEventById as jest.MockedFunction<
		typeof eventRepo.findEventById
	>;
	const findEventByIdServiceMock = eventRepo.findEventByIdService as jest.MockedFunction<
		typeof eventRepo.findEventByIdService
	>;
	const findEventBySlugServiceMock = eventRepo.findEventBySlugService as jest.MockedFunction<
		typeof eventRepo.findEventBySlugService
	>;
	const findEventsByOwnerMock = eventRepo.findEventsByOwner as jest.MockedFunction<
		typeof eventRepo.findEventsByOwner
	>;
	const findEventsForHostMock = eventRepo.findEventsForHost as jest.MockedFunction<
		typeof eventRepo.findEventsForHost
	>;
	const listAllEventsServiceMock = eventRepo.listAllEventsService as jest.MockedFunction<
		typeof eventRepo.listAllEventsService
	>;
	const findGuestsByEventMock = guestRepo.findGuestsByEvent as jest.MockedFunction<
		typeof guestRepo.findGuestsByEvent
	>;
	const createGuestInvitationMock = guestRepo.createGuestInvitation as jest.MockedFunction<
		typeof guestRepo.createGuestInvitation
	>;
	const findGuestByIdMock = guestRepo.findGuestById as jest.MockedFunction<
		typeof guestRepo.findGuestById
	>;
	const findGuestByInviteIdPublicMock =
		guestRepo.findGuestByInviteIdPublic as jest.MockedFunction<
			typeof guestRepo.findGuestByInviteIdPublic
		>;
	const findGuestByPhoneAuthMock = guestRepo.findGuestByPhoneAuth as jest.MockedFunction<
		typeof guestRepo.findGuestByPhoneAuth
	>;
	const updateGuestByIdMock = guestRepo.updateGuestById as jest.MockedFunction<
		typeof guestRepo.updateGuestById
	>;
	const submitGuestRsvpPublicRpcMock = guestRepo.submitGuestRsvpPublicRpc as jest.MockedFunction<
		typeof guestRepo.submitGuestRsvpPublicRpc
	>;
	const trackGuestInvitationViewPublicRpcMock =
		guestRepo.trackGuestInvitationViewPublicRpc as jest.MockedFunction<
			typeof guestRepo.trackGuestInvitationViewPublicRpc
		>;
	const softDeleteGuestByIdMock = guestRepo.softDeleteGuestById as jest.MockedFunction<
		typeof guestRepo.softDeleteGuestById
	>;
	const findEventByInvitationPublicMock =
		eventRepo.findEventByInvitationPublic as jest.MockedFunction<
			typeof eventRepo.findEventByInvitationPublic
		>;
	const findMembershipByEventForHostMock =
		membershipRepo.findMembershipByEventForHost as jest.MockedFunction<
			typeof membershipRepo.findMembershipByEventForHost
		>;
	const listMembershipsForHostMock = membershipRepo.listMembershipsForHost as jest.MockedFunction<
		typeof membershipRepo.listMembershipsForHost
	>;

	const baseEvent = {
		id: 'evt-1',
		ownerUserId: 'host-1',
		slug: 'demo',
		eventType: 'cumple' as const,
		title: 'Demo',
		status: 'published' as const,
		publishedAt: null,
		invitationId: null,
		brandingRemovalGuestLimit: 0,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	const baseGuest = {
		id: 'guest-1',
		inviteId: 'invite-1',
		eventId: 'evt-1',
		fullName: 'Guest',
		phone: '6680000000',
		countryCode: '+52',
		maxAllowedAttendees: 2,
		attendanceStatus: 'pending' as const,
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated' as const,
		firstSharedAt: null,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		lastViewedAt: null,
		respondedAt: null,
		lastResponseSource: 'link' as const,
		entrySource: 'dashboard' as const,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		findEventByIdMock.mockResolvedValue(baseEvent);
		findEventsByOwnerMock.mockResolvedValue([baseEvent]);
		findEventsForHostMock.mockResolvedValue([baseEvent]);
		findEventBySlugServiceMock.mockResolvedValue(baseEvent);
		findGuestsByEventMock.mockResolvedValue([baseGuest]);
		listMembershipsForHostMock.mockResolvedValue([]);
	});

	it('listDashboardGuests includes the engagement summary for the host', async () => {
		const engagement = {
			guests: 1,
			shared: 1,
			previewed: 0,
			opened: 1,
			formViewed: 0,
			formStarted: 0,
			responded: 0,
			openedNotResponded: 1,
			medianSecondsToOpen: 120,
			trackingStartedAt: '2026-10-10T00:00:00Z',
		};
		findEventByIdMock.mockResolvedValueOnce(baseEvent);
		(engagementRepo.getEventEngagementSummary as jest.Mock).mockResolvedValueOnce(engagement);
		const result = await listDashboardGuests({
			eventId: 'evt-1',
			userId: 'user-1',
			hostAccessToken: 'token',
			origin: 'http://localhost',
		});
		expect(engagementRepo.getEventEngagementSummary).toHaveBeenCalledWith('evt-1', 'token');
		expect(result.engagement).toEqual(engagement);
	});

	it('listDashboardGuests hides the funnel when the summary fails', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		findEventByIdMock.mockResolvedValueOnce(baseEvent);
		(engagementRepo.getEventEngagementSummary as jest.Mock).mockRejectedValueOnce(
			new Error('schema behind'),
		);
		const result = await listDashboardGuests({
			eventId: 'evt-1',
			userId: 'user-1',
			hostAccessToken: 'token',
			origin: 'http://localhost',
		});
		expect(result.engagement).toBeNull();
		expect(result.items).toHaveLength(1);
		warn.mockRestore();
	});

	it('listDashboardGuests throws forbidden when service role finds event but host token does not', async () => {
		findEventByIdMock.mockResolvedValueOnce(null);
		findMembershipByEventForHostMock.mockResolvedValueOnce(null);
		findEventByIdServiceMock.mockResolvedValueOnce(baseEvent);

		await expect(
			listDashboardGuests({
				eventId: 'evt-1',
				userId: 'user-1',
				hostAccessToken: 'token',
				origin: 'http://localhost',
			}),
		).rejects.toMatchObject({ status: 403, code: 'forbidden' });
	});

	it('createDashboardGuest validates required fields', async () => {
		await expect(
			createDashboardGuest({
				eventId: 'evt-1',
				fullName: '',
				phone: '6680000000',
				maxAllowedAttendees: 2,
				hostAccessToken: 'token',
				origin: 'http://localhost',
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('createDashboardGuest maps a duplicate-phone Supabase error to the friendly 409', async () => {
		const duplicateBody = JSON.stringify({
			code: '23505',
			details: 'Key (event_id, country_code, phone) already exists.',
			hint: null,
			message:
				'duplicate key value violates unique constraint "guest_invitations_event_country_phone_active_unique"',
		});
		createGuestInvitationMock.mockRejectedValueOnce(
			new SupabaseHttpError(409, duplicateBody, '23505'),
		);

		await expect(
			createDashboardGuest({
				eventId: 'evt-1',
				fullName: 'Guest',
				phone: '6680000000',
				countryCode: '+52',
				maxAllowedAttendees: 2,
				hostAccessToken: 'token',
				origin: 'http://localhost',
			}),
		).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
			message: 'Ya existe un invitado con ese número de teléfono.',
		});
	});

	it('createDashboardGuest preserves a configured attendee limit above 20', async () => {
		createGuestInvitationMock.mockResolvedValue({
			...baseGuest,
			maxAllowedAttendees: 250,
		});
		const result = await createDashboardGuest({
			eventId: 'evt-1',
			fullName: 'Guest',
			phone: '6680000000',
			countryCode: '+52',
			maxAllowedAttendees: 250,
			hostAccessToken: 'token',
			origin: 'http://localhost',
		});
		expect(createGuestInvitationMock).toHaveBeenCalledWith(
			expect.objectContaining({ maxAllowedAttendees: 250 }),
			expect.any(String),
		);
		expect(result.item.maxAllowedAttendees).toBe(250);
	});

	it('updateDashboardGuest enforces confirmed attendee bounds', async () => {
		findGuestByIdMock.mockResolvedValue(baseGuest);
		await expect(
			updateDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
				origin: 'http://localhost',
				attendanceStatus: 'confirmed',
				attendeeCount: 0,
			}),
		).rejects.toMatchObject({ status: 400 });

		await expect(
			updateDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
				origin: 'http://localhost',
				attendanceStatus: 'confirmed',
				attendeeCount: 10,
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('updateDashboardGuest preserves duplicate phone conflicts as 409', async () => {
		findGuestByIdMock.mockResolvedValue(baseGuest);
		findGuestByPhoneAuthMock.mockResolvedValue({
			...baseGuest,
			id: 'guest-2',
			phone: '6680000001',
			countryCode: '+52',
		});
		updateGuestByIdMock.mockRejectedValue(
			new ApiError(500, 'internal_error', 'Should not reach update.'),
		);

		await expect(
			updateDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
				origin: 'http://localhost',
				fullName: 'Guest',
				phone: '6680000001',
				countryCode: '+52',
				maxAllowedAttendees: 2,
			}),
		).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});
		expect(updateGuestByIdMock).not.toHaveBeenCalled();
		expect(findGuestByPhoneAuthMock).toHaveBeenCalledWith(
			'evt-1',
			'+52',
			'6680000001',
			'token',
		);
	});

	it('updateDashboardGuest clears phone without duplicate lookup', async () => {
		findGuestByIdMock.mockResolvedValue(baseGuest);
		updateGuestByIdMock.mockResolvedValue({
			...baseGuest,
			phone: '',
			countryCode: undefined,
		});

		await updateDashboardGuest({
			guestId: 'guest-1',
			hostAccessToken: 'token',
			origin: 'http://localhost',
			phone: null,
		});

		expect(findGuestByPhoneAuthMock).not.toHaveBeenCalled();
		expect(updateGuestByIdMock).toHaveBeenCalledWith(
			expect.objectContaining({
				guestId: 'guest-1',
				phone: null,
				countryCode: undefined,
			}),
			'token',
		);
	});

	it('markGuestShared returns not_found when guest does not exist', async () => {
		findGuestByIdMock.mockResolvedValue(null);
		await expect(
			markGuestShared({
				guestId: 'guest-missing',
				hostAccessToken: 'token',
				origin: 'http://localhost',
			}),
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteDashboardGuest soft deletes active guests and treats deleted guests as missing', async () => {
		findGuestByIdMock.mockResolvedValueOnce(baseGuest);
		softDeleteGuestByIdMock.mockResolvedValueOnce(true);

		await expect(
			deleteDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
				actorUserId: 'host-1',
			}),
		).resolves.toBeUndefined();
		expect(softDeleteGuestByIdMock).toHaveBeenCalledWith('guest-1', 'host-1');

		findGuestByIdMock.mockResolvedValueOnce(null);

		await expect(
			deleteDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
				actorUserId: 'host-1',
			}),
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteDashboardGuest returns 404 when the guest was deleted concurrently', async () => {
		findGuestByIdMock.mockResolvedValueOnce(baseGuest);
		softDeleteGuestByIdMock.mockResolvedValueOnce(false);

		await expect(
			deleteDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
				actorUserId: 'host-1',
			}),
		).rejects.toMatchObject({ status: 404, code: 'not_found' });
	});

	it('deleteDashboardGuest maps database access denials to a redacted 403 and skips the admin audit', async () => {
		const rlsBody = JSON.stringify({
			code: '42501',
			details: null,
			hint: null,
			message: 'guest_invitation_access_denied',
		});
		findGuestByIdMock.mockResolvedValueOnce(baseGuest);
		softDeleteGuestByIdMock.mockRejectedValueOnce(new SupabaseHttpError(403, rlsBody, '42501'));

		const failure = deleteDashboardGuest({
			guestId: 'guest-1',
			hostAccessToken: 'token',
			actorUserId: 'admin-1',
			isSuperAdmin: true,
		});

		await expect(failure).rejects.toMatchObject({ status: 403, code: 'forbidden' });
		await failure.catch((error: Error) => {
			expect(error.message).not.toContain('guest_invitation_access_denied');
			expect(error.message).not.toContain('Supabase error');
		});
		expect(logAdminAction).not.toHaveBeenCalled();
	});

	it('deleteDashboardGuest records the super admin audit only after a successful soft delete', async () => {
		findGuestByIdMock.mockResolvedValueOnce(baseGuest);
		softDeleteGuestByIdMock.mockResolvedValueOnce(true);

		await deleteDashboardGuest({
			guestId: 'guest-1',
			hostAccessToken: 'token',
			actorUserId: 'admin-1',
			isSuperAdmin: true,
		});

		expect(logAdminAction).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'delete_guest', targetId: 'guest-1', newData: null }),
		);
		expect(softDeleteGuestByIdMock.mock.invocationCallOrder[0]).toBeLessThan(
			(logAdminAction as jest.Mock).mock.invocationCallOrder[0],
		);
	});

	it('getInvitationContext validates invite and event existence', async () => {
		await expect(getInvitationContextByInviteId('')).rejects.toMatchObject({ status: 400 });
		findGuestByInviteIdPublicMock.mockResolvedValue(baseGuest);
		findEventByInvitationPublicMock.mockResolvedValue(null);
		await expect(getInvitationContextByInviteId('invite-1')).rejects.toMatchObject({
			status: 404,
		});
	});

	it('submitGuestRsvp validates status and limits', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(baseGuest);
		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'pending' as never,
				attendeeCount: 1,
			}),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 0,
			}),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 10,
			}),
		).rejects.toMatchObject({
			status: 400,
			message: 'The limit for this invitation is 2.',
		});
	});

	it('submitGuestRsvpByPublicEvent does not look up or modify an existing phone collision', async () => {
		submitGuestRsvpPublicRpcMock.mockRejectedValue(
			new Error(
				'duplicate key value violates unique constraint "guest_invitations_event_country_phone_active_unique"',
			),
		);

		await expect(
			submitGuestRsvpByPublicEvent({
				event: baseEvent,
				fullName: 'Guest',
				phone: '6680000000',
				countryCode: '+52',
				maxAllowedAttendees: 3,
				payload: {
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Nos vemos',
				},
			}),
		).rejects.toMatchObject({
			status: 409,
			code: 'conflict',
		});

		expect(createGuestInvitationMock).not.toHaveBeenCalled();
		expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: 'evt-1',
				fullName: 'Guest',
				phone: '6680000000',
				responseSource: 'generic_link',
			}),
		);
	});

	it('submitGuestRsvpByPublicEvent creates a generic public guest when the phone is new', async () => {
		submitGuestRsvpPublicRpcMock.mockResolvedValue({
			...baseGuest,
			id: 'guest-2',
			inviteId: 'invite-2',
			fullName: 'Mariana Soto',
			phone: '6681112233',
			maxAllowedAttendees: 3,
			attendanceStatus: 'confirmed',
			attendeeCount: 3,
			lastResponseSource: 'generic_link',
			entrySource: 'generic_public',
			respondedAt: new Date().toISOString(),
		});

		const result = await submitGuestRsvpByPublicEvent({
			event: baseEvent,
			fullName: 'Mariana Soto',
			phone: '(668) 111-2233',
			countryCode: '+52',
			maxAllowedAttendees: 3,
			payload: {
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
				guestComment: 'Ahí estaremos',
			},
		});

		expect(createGuestInvitationMock).not.toHaveBeenCalled();
		expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: 'evt-1',
				fullName: 'Mariana Soto',
				phone: '6681112233',
				countryCode: '+52',
				maxAllowedAttendees: 3,
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
				guestComment: 'Ahí estaremos',
				responseSource: 'generic_link',
			}),
		);
		expect(result.entrySource).toBe('generic_public');
	});

	it('trackInvitationView degrades gracefully when track RPC fails', async () => {
		trackGuestInvitationViewPublicRpcMock.mockRejectedValue(new Error('rpc failed'));
		await expect(trackInvitationView('missing')).resolves.toBeUndefined();
		expect(trackGuestInvitationViewPublicRpcMock).toHaveBeenCalledWith('missing', undefined);
	});

	it('listHostEvents merges owner, visible, and membership-backed events without duplicates', async () => {
		findEventsByOwnerMock.mockResolvedValue([
			{
				...baseEvent,
				id: 'evt-owner',
				createdAt: '2026-04-01T10:00:00.000Z',
			},
		]);
		findEventsForHostMock.mockResolvedValue([
			{
				...baseEvent,
				id: 'evt-superadmin',
				title: 'Admin Visible',
				createdAt: '2026-04-03T10:00:00.000Z',
			},
		]);
		listMembershipsForHostMock.mockResolvedValue([
			{
				id: 'membership-1',
				eventId: 'evt-member',
				userId: 'host-1',
				membershipRole: 'manager',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);
		findEventByIdMock.mockResolvedValueOnce(null);
		findEventByIdServiceMock.mockResolvedValueOnce({
			...baseEvent,
			id: 'evt-member',
			title: 'Membership Event',
			createdAt: '2026-04-02T10:00:00.000Z',
		});

		const result = await listHostEvents({
			hostUserId: 'host-1',
			hostAccessToken: 'token',
		});

		expect(result.map((event) => event.id)).toEqual([
			'evt-superadmin',
			'evt-member',
			'evt-owner',
		]);
		expect(findEventByIdMock).toHaveBeenCalledWith('evt-member', 'token');
		expect(findEventByIdServiceMock).toHaveBeenCalledWith('evt-member');
	});

	it('listHostEvents uses listAllEventsService for super_admin and skips host-scoped queries', async () => {
		listAllEventsServiceMock.mockResolvedValue([
			{
				...baseEvent,
				id: 'evt-all-1',
				title: 'All Events One',
				createdAt: '2026-04-03T10:00:00.000Z',
			},
			{
				...baseEvent,
				id: 'evt-all-2',
				title: 'All Events Two',
				createdAt: '2026-04-01T10:00:00.000Z',
			},
		]);

		const result = await listHostEvents({
			hostUserId: 'admin-1',
			hostAccessToken: 'token',
			isSuperAdmin: true,
		});

		expect(result.map((event) => event.id)).toEqual(['evt-all-1', 'evt-all-2']);
		expect(listAllEventsServiceMock).toHaveBeenCalledTimes(1);
		expect(findEventsByOwnerMock).not.toHaveBeenCalled();
		expect(findEventsForHostMock).not.toHaveBeenCalled();
		expect(listMembershipsForHostMock).not.toHaveBeenCalled();
	});

	it('listHostEventsWithDebug marks super_admin session when listing all events', async () => {
		listAllEventsServiceMock.mockResolvedValue([
			{
				...baseEvent,
				id: 'evt-all-1',
			},
		]);

		const result = await listHostEventsWithDebug({
			hostUserId: 'admin-1',
			hostAccessToken: 'token',
			isSuperAdmin: true,
			requestedSlug: 'fixture-event',
		});

		expect(result.events).toHaveLength(1);
		expect(result.debug.session.isSuperAdmin).toBe(true);
		expect(result.debug.session.role).toBe('super_admin');
		expect(result.debug.visibleEvents).toHaveLength(1);
		expect(findEventBySlugServiceMock).toHaveBeenCalledWith('fixture-event');
	});

	it('listHostEventsWithDebug reports requested slug diagnostics and unresolved memberships', async () => {
		findEventsByOwnerMock.mockResolvedValue([]);
		findEventsForHostMock.mockResolvedValue([]);
		listMembershipsForHostMock.mockResolvedValue([
			{
				id: 'membership-1',
				eventId: 'evt-hidden',
				userId: 'host-1',
				membershipRole: 'manager',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);
		findEventByIdMock.mockResolvedValueOnce(null);
		findEventByIdServiceMock.mockResolvedValueOnce(null);
		findEventBySlugServiceMock.mockResolvedValueOnce({
			...baseEvent,
			id: 'evt-ximena',
			slug: 'fixture-event',
			ownerUserId: 'other-host',
		});

		const result = await listHostEventsWithDebug({
			hostUserId: 'host-1',
			hostAccessToken: 'token',
			requestedSlug: 'fixture-event',
		});

		expect(result.events).toEqual([]);
		expect(result.debug.requestedSlugCheck?.slugExistsInDb).toBe(true);
		expect(result.debug.unresolvedMembershipEventIds).toEqual(['evt-hidden']);
	});
});
