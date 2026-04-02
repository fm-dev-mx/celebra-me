import { claimEventForUserByClaimCode } from '@/lib/rsvp/services/auth-access.service';
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
import * as claimRepo from '@/lib/rsvp/repositories/claim-code.repository';

jest.mock('@/lib/rsvp/repositories/event.repository');
jest.mock('@/lib/rsvp/repositories/guest.repository');
jest.mock('@/lib/rsvp/repositories/role-membership.repository');
jest.mock('@/lib/rsvp/repositories/claim-code.repository');

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
	const findGuestsByEventMock = guestRepo.findGuestsByEvent as jest.MockedFunction<
		typeof guestRepo.findGuestsByEvent
	>;
	const createGuestInvitationMock = guestRepo.createGuestInvitation as jest.MockedFunction<
		typeof guestRepo.createGuestInvitation
	>;
	const createGuestInvitationPublicMock =
		guestRepo.createGuestInvitationPublic as jest.MockedFunction<
			typeof guestRepo.createGuestInvitationPublic
		>;
	const findGuestByIdMock = guestRepo.findGuestById as jest.MockedFunction<
		typeof guestRepo.findGuestById
	>;
	const findGuestByIdServiceMock = guestRepo.findGuestByIdService as jest.MockedFunction<
		typeof guestRepo.findGuestByIdService
	>;
	const findGuestByInviteIdPublicMock =
		guestRepo.findGuestByInviteIdPublic as jest.MockedFunction<
			typeof guestRepo.findGuestByInviteIdPublic
		>;
	const findGuestByPhoneMock = guestRepo.findGuestByPhone as jest.MockedFunction<
		typeof guestRepo.findGuestByPhone
	>;
	const updateGuestByIdServiceMock = guestRepo.updateGuestByIdService as jest.MockedFunction<
		typeof guestRepo.updateGuestByIdService
	>;
	const softDeleteGuestByIdMock = guestRepo.softDeleteGuestById as jest.MockedFunction<
		typeof guestRepo.softDeleteGuestById
	>;
	const findEventByInvitationPublicMock =
		eventRepo.findEventByInvitationPublic as jest.MockedFunction<
			typeof eventRepo.findEventByInvitationPublic
		>;
	const redeemClaimCodeRpcMock = claimRepo.redeemClaimCodeRpc as jest.MockedFunction<
		typeof claimRepo.redeemClaimCodeRpc
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
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	const baseGuest = {
		id: 'guest-1',
		inviteId: 'invite-1',
		eventId: 'evt-1',
		fullName: 'Guest',
		phone: '6680000000',
		maxAllowedAttendees: 2,
		attendanceStatus: 'pending' as const,
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated' as const,
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

	it('listDashboardGuests throws forbidden when service role finds event but host token does not', async () => {
		findEventByIdMock.mockResolvedValueOnce(null);
		findMembershipByEventForHostMock.mockResolvedValueOnce(null);
		findEventByIdServiceMock.mockResolvedValueOnce(baseEvent);

		await expect(
			listDashboardGuests({
				eventId: 'evt-1',
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

	it('createDashboardGuest clamps maxAllowedAttendees and succeeds', async () => {
		createGuestInvitationMock.mockResolvedValue({
			...baseGuest,
			maxAllowedAttendees: 20,
		});
		const result = await createDashboardGuest({
			eventId: 'evt-1',
			fullName: 'Guest',
			phone: '6680000000',
			maxAllowedAttendees: 100,
			hostAccessToken: 'token',
			origin: 'http://localhost',
		});
		expect(result.item.maxAllowedAttendees).toBe(20);
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

	it('markGuestShared returns not_found when guest does not exist', async () => {
		findGuestByIdMock.mockResolvedValue(null);
		findGuestByIdServiceMock.mockResolvedValue(null);
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
		softDeleteGuestByIdMock.mockResolvedValueOnce(undefined);

		await expect(
			deleteDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
			}),
		).resolves.toBeUndefined();
		expect(softDeleteGuestByIdMock).toHaveBeenCalledWith('guest-1', 'token');

		findGuestByIdMock.mockResolvedValueOnce(null);
		findGuestByIdServiceMock.mockResolvedValueOnce(null);

		await expect(
			deleteDashboardGuest({
				guestId: 'guest-1',
				hostAccessToken: 'token',
			}),
		).rejects.toMatchObject({ status: 404 });
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
	});

	it('submitGuestRsvpByPublicEvent updates the matching guest when the phone already exists', async () => {
		findGuestByPhoneMock.mockResolvedValue(baseGuest);
		updateGuestByIdServiceMock.mockResolvedValue({
			...baseGuest,
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			lastResponseSource: 'generic_link',
			entrySource: 'dashboard',
			respondedAt: new Date().toISOString(),
		});

		const result = await submitGuestRsvpByPublicEvent({
			event: baseEvent,
			fullName: 'Guest',
			phone: '6680000000',
			maxAllowedAttendees: 3,
			payload: {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: 'Nos vemos',
			},
		});

		expect(findGuestByPhoneMock).toHaveBeenCalledWith('evt-1', '6680000000');
		expect(createGuestInvitationPublicMock).not.toHaveBeenCalled();
		expect(updateGuestByIdServiceMock).toHaveBeenCalledWith(
			expect.objectContaining({
				guestId: 'guest-1',
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				lastResponseSource: 'generic_link',
			}),
		);
		expect(result.entrySource).toBe('dashboard');
	});

	it('submitGuestRsvpByPublicEvent creates a generic public guest when the phone is new', async () => {
		findGuestByPhoneMock.mockResolvedValue(null);
		createGuestInvitationPublicMock.mockResolvedValue({
			...baseGuest,
			id: 'guest-2',
			inviteId: 'invite-2',
			fullName: 'Mariana Soto',
			phone: '6681112233',
			maxAllowedAttendees: 3,
			entrySource: 'generic_public',
		});
		updateGuestByIdServiceMock.mockResolvedValue({
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
			maxAllowedAttendees: 3,
			payload: {
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
				guestComment: 'Ahí estaremos',
			},
		});

		expect(createGuestInvitationPublicMock).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: 'evt-1',
				fullName: 'Mariana Soto',
				phone: '6681112233',
				maxAllowedAttendees: 3,
				entrySource: 'generic_public',
			}),
		);
		expect(updateGuestByIdServiceMock).toHaveBeenCalledWith(
			expect.objectContaining({
				guestId: 'guest-2',
				lastResponseSource: 'generic_link',
			}),
		);
		expect(result.entrySource).toBe('generic_public');
	});

	it('trackInvitationView throws not_found on missing invite', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(null);
		await expect(trackInvitationView('missing')).rejects.toMatchObject({ status: 404 });
	});

	it('claimEventForUser validates claim states via atomic RPC', async () => {
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: true,
			eventId: 'evt-1',
			membershipRole: 'owner',
			errorCode: null,
		});

		const result = await claimEventForUserByClaimCode({
			userId: 'host-1',
			claimCode: 'abc123',
		});

		expect(redeemClaimCodeRpcMock).toHaveBeenCalledWith({
			userId: 'host-1',
			codeKey: expect.any(String),
		});
		expect(result).toEqual({
			eventId: 'evt-1',
			membershipRole: 'owner',
		});
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
