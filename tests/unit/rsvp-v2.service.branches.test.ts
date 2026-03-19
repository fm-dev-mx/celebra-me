import { claimEventForUser, claimEventForUserByClaimCode } from '@/lib/rsvp/services/auth-access.service';
import { createDashboardGuest, listDashboardGuests, markGuestShared, updateDashboardGuest } from '@/lib/rsvp/services/dashboard-guests.service';
import { getInvitationContextByInviteId, resolveLegacyTokenToCanonicalUrl } from '@/lib/rsvp/services/invitation-context.service';
import { submitGuestRsvpByInviteId, trackInvitationView } from '@/lib/rsvp/services/rsvp-submission.service';
import * as eventRepo from '@/lib/rsvp/repositories/event.repository';
import * as guestRepo from '@/lib/rsvp/repositories/guest.repository';
import * as membershipRepo from '@/lib/rsvp/repositories/role-membership.repository';
import * as claimRepo from '@/lib/rsvp/repositories/claim-code.repository';

jest.mock('@/lib/rsvp/repositories/event.repository');
jest.mock('@/lib/rsvp/repositories/guest.repository');
jest.mock('@/lib/rsvp/repositories/role-membership.repository');
jest.mock('@/lib/rsvp/repositories/claim-code.repository');

describe('rsvp service branches', () => {
	const findEventByIdMock = eventRepo.findEventById as jest.MockedFunction<typeof eventRepo.findEventById>;
	const findEventByIdServiceMock = eventRepo.findEventByIdService as jest.MockedFunction<
		typeof eventRepo.findEventByIdService
	>;
	const findEventBySlugServiceMock = eventRepo.findEventBySlugService as jest.MockedFunction<
		typeof eventRepo.findEventBySlugService
	>;
	const findGuestsByEventMock = guestRepo.findGuestsByEvent as jest.MockedFunction<
		typeof guestRepo.findGuestsByEvent
	>;
	const createGuestInvitationMock = guestRepo.createGuestInvitation as jest.MockedFunction<
		typeof guestRepo.createGuestInvitation
	>;
	const findGuestByIdMock = guestRepo.findGuestById as jest.MockedFunction<typeof guestRepo.findGuestById>;
	const findGuestByIdServiceMock = guestRepo.findGuestByIdService as jest.MockedFunction<
		typeof guestRepo.findGuestByIdService
	>;
	const findGuestByInviteIdPublicMock = guestRepo.findGuestByInviteIdPublic as jest.MockedFunction<
		typeof guestRepo.findGuestByInviteIdPublic
	>;
	const findGuestByShortIdPublicMock = guestRepo.findGuestByShortIdPublic as jest.MockedFunction<
		typeof guestRepo.findGuestByShortIdPublic
	>;
	const findEventByInvitationPublicMock = eventRepo.findEventByInvitationPublic as jest.MockedFunction<
		typeof eventRepo.findEventByInvitationPublic
	>;
	const redeemClaimCodeRpcMock = claimRepo.redeemClaimCodeRpc as jest.MockedFunction<
		typeof claimRepo.redeemClaimCodeRpc
	>;
	const findMembershipByEventForHostMock = membershipRepo.findMembershipByEventForHost as jest.MockedFunction<
		typeof membershipRepo.findMembershipByEventForHost
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
		findEventBySlugServiceMock.mockResolvedValue(baseEvent);
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
		expect(
			await resolveLegacyTokenToCanonicalUrl({
				eventSlug: 'demo',
				token: 'bad-format-token',
				origin: 'http://localhost',
			}),
		).toBeNull();

		findGuestByInviteIdPublicMock.mockResolvedValue(null);
		expect(
			await resolveLegacyTokenToCanonicalUrl({
				eventSlug: 'demo',
				token: 'e297864e-0c7f-4b08-963d-4a1e96e00123', // Valid UUID format
				origin: 'http://localhost',
			}),
		).toBeNull();
	});

	it('resolveLegacyTokenToCanonicalUrl returns canonical URL for valid UUID', async () => {
		const uuid = 'e297864e-0c7f-4b08-963d-4a1e96e00123';
		findGuestByInviteIdPublicMock.mockResolvedValue({ ...baseGuest, inviteId: uuid });

		const result = await resolveLegacyTokenToCanonicalUrl({
			eventSlug: 'demo',
			token: uuid,
			origin: 'http://localhost',
		});

		expect(result).toContain(uuid);
	});

	it('resolveLegacyTokenToCanonicalUrl returns canonical URL for valid ShortId', async () => {
		const shortId = 'ABC12345';
		findGuestByShortIdPublicMock.mockResolvedValue({ ...baseGuest, inviteId: 'some-uuid' });

		const result = await resolveLegacyTokenToCanonicalUrl({
			eventSlug: 'demo',
			token: shortId,
			origin: 'http://localhost',
		});

		expect(result).toContain('some-uuid');
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
