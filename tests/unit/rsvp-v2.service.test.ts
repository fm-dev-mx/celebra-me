import {
	submitGuestRsvpByInviteId,
	submitGuestRsvpByPublicEvent,
} from '@/lib/rsvp/services/rsvp-submission.service';
import {
	findGuestByInviteIdPublic,
	submitGuestRsvpPublicRpc,
} from '@/lib/rsvp/repositories/guest.repository';
import {
	RSVP_SUBMIT_BY_INVITE_MUTATION_RPCS,
	RSVP_SUBMIT_BY_INVITE_SERVICE_LOOKUPS,
} from '@/lib/rsvp/rsvp-operation-contract';
import { assertObservedOperationCount } from '@/lib/invitation/delivery-contract';
import { isEventInvitationUnavailable } from '@/lib/invitation/access/invitation-access.repository';
import type { EventRecord, GuestInvitationRecord } from '@/interfaces/rsvp/domain.interface';

jest.mock('@/lib/rsvp/repositories/guest.repository');
jest.mock('@/lib/invitation/access/invitation-access.repository', () => ({
	...jest.requireActual('@/lib/invitation/access/invitation-access.repository'),
	isEventInvitationUnavailable: jest.fn().mockResolvedValue(false),
}));

const findGuestByInviteIdPublicMock = findGuestByInviteIdPublic as jest.MockedFunction<
	typeof findGuestByInviteIdPublic
>;
const submitGuestRsvpPublicRpcMock = submitGuestRsvpPublicRpc as jest.MockedFunction<
	typeof submitGuestRsvpPublicRpc
>;

function makeGuestRecord(overrides: Partial<GuestInvitationRecord> = {}): GuestInvitationRecord {
	return {
		id: 'guest-1',
		inviteId: 'invite-1',
		eventId: 'evt-1',
		fullName: 'Invitado',
		phone: '1000000004',
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		firstSharedAt: null,
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		lastViewedAt: null,
		respondedAt: null,
		lastResponseSource: 'link',
		entrySource: 'dashboard',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	} as GuestInvitationRecord;
}

describe('rsvp service unit', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('rejects an RSVP when the administrator disabled the invitation', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(makeGuestRecord());
		(isEventInvitationUnavailable as jest.Mock).mockResolvedValueOnce(true);

		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 1,
				guestComment: '',
			}),
		).rejects.toMatchObject({ status: 403, code: 'invitation_unavailable' });
		expect(submitGuestRsvpPublicRpcMock).not.toHaveBeenCalled();
	});

	it('persists declined RSVP with attendee_count forced to 0', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(makeGuestRecord());
		submitGuestRsvpPublicRpcMock.mockResolvedValue(
			makeGuestRecord({
				attendanceStatus: 'declined',
				attendeeCount: 0,
				guestComment: 'No podre asistir',
				respondedAt: new Date().toISOString(),
				lastResponseSource: 'link',
			}),
		);

		const result = await submitGuestRsvpByInviteId('invite-1', {
			attendanceStatus: 'declined',
			attendeeCount: 3,
			guestComment: 'No podre asistir',
		});

		expect(result.attendanceStatus).toBe('declined');
		expect(result.attendeeCount).toBe(0);
		assertObservedOperationCount(
			findGuestByInviteIdPublicMock.mock.calls.length,
			RSVP_SUBMIT_BY_INVITE_SERVICE_LOOKUPS,
			'rsvp-lookup',
		);
		assertObservedOperationCount(
			submitGuestRsvpPublicRpcMock.mock.calls.length,
			RSVP_SUBMIT_BY_INVITE_MUTATION_RPCS,
			'rsvp-rpc',
		);
	});

	describe('message preservation', () => {
		it('keeps existing message when new payload has blank guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Anterior mensaje',
					respondedAt: new Date().toISOString(),
					lastResponseSource: 'link',
				}),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: '',
			});

			expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
				expect.objectContaining({
					inviteId: 'invite-1',
					guestComment: null,
				}),
			);
		});

		it('keeps existing message when new payload has whitespace-only guestComment', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: 'Anterior mensaje',
					respondedAt: new Date().toISOString(),
					lastResponseSource: 'link',
				}),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: '   ',
			});

			expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
				expect.objectContaining({
					inviteId: 'invite-1',
					guestComment: null,
				}),
			);
		});

		it('passes absolute appended comment for RPC SET ownership', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ guestComment: 'Anterior mensaje' }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					respondedAt: new Date().toISOString(),
					lastResponseSource: 'link',
				}),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: 'Nuevo mensaje',
			});

			const call = submitGuestRsvpPublicRpcMock.mock.calls[0][0];
			expect(call.inviteId).toBe('invite-1');
			expect(call.guestComment).toContain('Anterior mensaje');
			expect(call.guestComment).toContain('Nuevo mensaje');
		});
	});

	describe('children category and public availability', () => {
		it('persists childrenCount when within maxAllowedChildren and forces 0 when declined', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ maxAllowedAttendees: 4, maxAllowedChildren: 2 }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'confirmed',
					attendeeCount: 3,
					childrenCount: 2,
					respondedAt: new Date().toISOString(),
				}),
			);

			const confirmed = await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
				childrenCount: 2,
				guestComment: '',
			});
			expect(confirmed.childrenCount).toBe(2);
			expect(submitGuestRsvpPublicRpcMock).toHaveBeenLastCalledWith(
				expect.objectContaining({
					inviteId: 'invite-1',
					attendeeCount: 3,
					childrenCount: 2,
				}),
			);

			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({
					attendanceStatus: 'declined',
					attendeeCount: 0,
					childrenCount: 0,
					respondedAt: new Date().toISOString(),
				}),
			);
			const declined = await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'declined',
				attendeeCount: 3,
				childrenCount: 2,
				guestComment: '',
			});
			expect(declined.childrenCount).toBe(0);
			expect(submitGuestRsvpPublicRpcMock).toHaveBeenLastCalledWith(
				expect.objectContaining({
					inviteId: 'invite-1',
					attendeeCount: 0,
					childrenCount: 0,
				}),
			);
		});

		it('rejects RSVP when childrenCount exceeds maxAllowedChildren or attendeeCount', async () => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ maxAllowedAttendees: 4, maxAllowedChildren: 1 }),
			);

			await expect(
				submitGuestRsvpByInviteId('invite-1', {
					attendanceStatus: 'confirmed',
					attendeeCount: 3,
					childrenCount: 2,
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'Children count exceeds the limit for this invitation.',
			});

			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ maxAllowedAttendees: 4, maxAllowedChildren: 3 }),
			);
			await expect(
				submitGuestRsvpByInviteId('invite-1', {
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
					childrenCount: 2,
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'Children count exceeds the limit for this invitation.',
			});
		});

		it('rejects a public RSVP when the event invitation is expired or unavailable', async () => {
			(isEventInvitationUnavailable as jest.Mock).mockResolvedValueOnce(true);

			await expect(
				submitGuestRsvpByPublicEvent({
					event: {
						id: 'evt-1',
						ownerUserId: 'host-1',
						slug: 'evento',
						eventType: 'xv',
						title: 'XV',
						status: 'published',
						publishedAt: null,
						invitationId: 'inv-1',
						brandingRemovalGuestLimit: 0,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					} as EventRecord,
					fullName: 'Invitada',
					phone: '',
					maxAllowedAttendees: 2,
					payload: {
						attendanceStatus: 'confirmed',
						attendeeCount: 2,
					},
				}),
			).rejects.toMatchObject({ status: 403, code: 'invitation_unavailable' });
			expect(submitGuestRsvpPublicRpcMock).not.toHaveBeenCalled();
		});
	});
});

describe('rsvp service: adult-only passes never take children', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	const adultOnlyPasses: Array<[string, number | null | undefined]> = [
		['0', 0],
		['null', null],
		['undefined', undefined],
	];

	it.each(adultOnlyPasses)(
		'rejects childrenCount > 0 end to end when maxAllowedChildren is %s',
		async (_label, maxAllowedChildren) => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({
					maxAllowedChildren: maxAllowedChildren as number | undefined,
				}),
			);

			await expect(
				submitGuestRsvpByInviteId('invite-1', {
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					childrenCount: 1,
					guestComment: '',
				}),
			).rejects.toMatchObject({ status: 400, code: 'bad_request' });
			expect(submitGuestRsvpPublicRpcMock).not.toHaveBeenCalled();
		},
	);

	it.each(adultOnlyPasses)(
		'sends childrenCount 0 to the RPC for an adults-only confirmation (%s)',
		async (_label, maxAllowedChildren) => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ maxAllowedChildren: maxAllowedChildren as number | undefined }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({ attendanceStatus: 'confirmed', attendeeCount: 2 }),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				guestComment: '',
			});

			expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
				expect.objectContaining({ attendeeCount: 2, childrenCount: 0 }),
			);
		},
	);

	it.each(adultOnlyPasses)(
		'a decline resets children to 0 before the RPC (%s)',
		async (_label, maxAllowedChildren) => {
			findGuestByInviteIdPublicMock.mockResolvedValue(
				makeGuestRecord({ maxAllowedChildren: maxAllowedChildren as number | undefined }),
			);
			submitGuestRsvpPublicRpcMock.mockResolvedValue(
				makeGuestRecord({ attendanceStatus: 'declined', attendeeCount: 0 }),
			);

			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'declined',
				attendeeCount: 2,
				childrenCount: 2,
				guestComment: '',
			});

			expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
				expect.objectContaining({ attendeeCount: 0, childrenCount: 0 }),
			);
		},
	);

	it('accepts children up to the reserved child places and no more', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(makeGuestRecord({ maxAllowedChildren: 1 }));
		submitGuestRsvpPublicRpcMock.mockResolvedValue(
			makeGuestRecord({ attendanceStatus: 'confirmed', attendeeCount: 3, childrenCount: 1 }),
		);

		await submitGuestRsvpByInviteId('invite-1', {
			attendanceStatus: 'confirmed',
			attendeeCount: 3,
			childrenCount: 1,
			guestComment: '',
		});
		expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledWith(
			expect.objectContaining({ attendeeCount: 3, childrenCount: 1 }),
		);

		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 3,
				childrenCount: 2,
				guestComment: '',
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects 4 adults and 0 children when 1 of 4 passes is a child place', async () => {
		findGuestByInviteIdPublicMock.mockResolvedValue(
			makeGuestRecord({ maxAllowedAttendees: 4, maxAllowedChildren: 1 }),
		);
		submitGuestRsvpPublicRpcMock.mockResolvedValue(
			makeGuestRecord({ attendanceStatus: 'confirmed', attendeeCount: 3, childrenCount: 0 }),
		);

		await expect(
			submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 4,
				childrenCount: 0,
				guestComment: '',
			}),
		).rejects.toMatchObject({ status: 400, message: expect.stringContaining('3 adultos') });
		expect(submitGuestRsvpPublicRpcMock).not.toHaveBeenCalled();

		for (const [attendeeCount, childrenCount] of [
			[3, 1],
			[3, 0],
			[2, 1],
		]) {
			await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount,
				childrenCount,
				guestComment: '',
			});
		}
		expect(submitGuestRsvpPublicRpcMock).toHaveBeenCalledTimes(3);
	});
});
