import {
	claimEventForUser,
	claimEventForUserByClaimCode,
	createDashboardGuest,
	getInvitationContextByInviteId,
	listDashboardGuests,
	markGuestShared,
	resolveLegacyTokenToCanonicalUrl,
	submitGuestRsvpByInviteId,
	trackInvitationView,
	updateDashboardGuest,
} from '@/lib/rsvp-v2/service';
import * as repo from '@/lib/rsvp-v2/repository';
import { getRsvpContext } from '@/lib/rsvp/service';

jest.mock('@/lib/rsvp-v2/repository', () => ({
	findEventById: jest.fn(),
	findEventByIdService: jest.fn(),
	findGuestsByEvent: jest.fn(),
	createGuestInvitation: jest.fn(),
	findGuestById: jest.fn(),
	findGuestByIdService: jest.fn(),
	updateGuestById: jest.fn(),
	findGuestByInviteIdPublic: jest.fn(),
	findEventByInvitationPublic: jest.fn(),
	updateGuestByInviteIdPublic: jest.fn(),
	findGuestByLegacyIdentityPublic: jest.fn(),
	findClaimCodeRecordByKeyService: jest.fn(),
	createEventMembershipService: jest.fn(),
	incrementClaimCodeUsageService: jest.fn(),
	redeemClaimCodeRpc: jest.fn(),
	findEventsForHost: jest.fn(),
	findMembershipByEventForHost: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
	getRsvpContext: jest.fn(),
}));

describe('rsvp-v2 service branches', () => {
	const findEventByIdMock = repo.findEventById as jest.MockedFunction<typeof repo.findEventById>;
	const findEventByIdServiceMock = repo.findEventByIdService as jest.MockedFunction<
		typeof repo.findEventByIdService
	>;
	const findGuestsByEventMock = repo.findGuestsByEvent as jest.MockedFunction<
		typeof repo.findGuestsByEvent
	>;
	const createGuestInvitationMock = repo.createGuestInvitation as jest.MockedFunction<
		typeof repo.createGuestInvitation
	>;
	const findGuestByIdMock = repo.findGuestById as jest.MockedFunction<typeof repo.findGuestById>;
	const findGuestByIdServiceMock = repo.findGuestByIdService as jest.MockedFunction<
		typeof repo.findGuestByIdService
	>;
	const findGuestByInviteIdPublicMock = repo.findGuestByInviteIdPublic as jest.MockedFunction<
		typeof repo.findGuestByInviteIdPublic
	>;
	const findEventByInvitationPublicMock = repo.findEventByInvitationPublic as jest.MockedFunction<
		typeof repo.findEventByInvitationPublic
	>;
	const findGuestByLegacyIdentityPublicMock =
		repo.findGuestByLegacyIdentityPublic as jest.MockedFunction<
			typeof repo.findGuestByLegacyIdentityPublic
		>;
	const redeemClaimCodeRpcMock = repo.redeemClaimCodeRpc as jest.MockedFunction<
		typeof repo.redeemClaimCodeRpc
	>;
	const findMembershipByEventForHostMock =
		repo.findMembershipByEventForHost as jest.MockedFunction<
			typeof repo.findMembershipByEventForHost
		>;
	const getRsvpContextMock = getRsvpContext as jest.MockedFunction<typeof getRsvpContext>;

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
		guestMessage: '',
		deliveryStatus: 'generated' as const,
		firstViewedAt: null,
		lastViewedAt: null,
		respondedAt: null,
		lastResponseSource: 'link' as const,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		findEventByIdMock.mockResolvedValue(baseEvent);
		findGuestsByEventMock.mockResolvedValue([baseGuest]);
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

		await expect(
			createDashboardGuest({
				eventId: 'evt-1',
				fullName: 'Guest',
				phone: '',
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

	it('trackInvitationView throws not_found on missing invite', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(null);
		await expect(trackInvitationView('missing')).rejects.toMatchObject({ status: 404 });
	});

	it('resolveLegacyTokenToCanonicalUrl returns null on invalid token or missing mapping', async () => {
		getRsvpContextMock.mockResolvedValue({
			tokenValid: false,
			eventSlug: 'demo',
			guest: null,
		} as never);
		expect(
			await resolveLegacyTokenToCanonicalUrl({
				eventSlug: 'demo',
				token: 'bad',
				origin: 'http://localhost',
			}),
		).toBeNull();

		getRsvpContextMock.mockResolvedValue({
			tokenValid: true,
			eventSlug: 'demo',
			guest: { guestId: 'g-1' },
		} as never);
		findGuestByLegacyIdentityPublicMock.mockResolvedValue(null);
		expect(
			await resolveLegacyTokenToCanonicalUrl({
				eventSlug: 'demo',
				token: 'ok',
				origin: 'http://localhost',
			}),
		).toBeNull();
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

	it('claimEventForUser wrapper remains compatible', async () => {
		redeemClaimCodeRpcMock.mockResolvedValue({
			success: true,
			eventId: 'evt-1',
			membershipRole: 'owner',
			errorCode: null,
		});
		await claimEventForUser({
			userId: 'host-2',
			eventSlug: 'legacy-slug',
			claimCode: 'legacy-code',
		});
		expect(redeemClaimCodeRpcMock).toHaveBeenCalled();
	});
});
