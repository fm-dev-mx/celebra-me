import * as eventRepo from '@/lib/rsvp/repositories/event.repository';
import * as guestRepo from '@/lib/rsvp/repositories/guest.repository';
import { getSharingConfigForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import {
	assertRsvpOpen,
	loadPublicRsvpWindow,
	updateRsvpDeadline,
} from '@/lib/rsvp/services/rsvp-deadline.service';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/repositories/event.repository');
jest.mock('@/lib/rsvp/repositories/guest.repository');
jest.mock('@/lib/invitation/access/invitation-access.repository', () => ({
	...jest.requireActual('@/lib/invitation/access/invitation-access.repository'),
	isEventInvitationUnavailable: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/rsvp/services/shared/invitation-helpers', () => ({
	...jest.requireActual('@/lib/rsvp/services/shared/invitation-helpers'),
	getSharingConfigForSlug: jest.fn(),
}));

const findEventByIdService = eventRepo.findEventByIdService as jest.Mock;
const findEventBySlugService = eventRepo.findEventBySlugService as jest.Mock;
const updateEventService = eventRepo.updateEventService as jest.Mock;
const findGuestByInviteIdPublic = guestRepo.findGuestByInviteIdPublic as jest.Mock;
const submitGuestRsvpPublicRpc = guestRepo.submitGuestRsvpPublicRpc as jest.Mock;
const sharingConfig = getSharingConfigForSlug as jest.Mock;

const NOW = new Date('2026-11-16T18:00:00Z'); // Nov 16, 12:00 in Chihuahua.
const baseEvent = {
	id: 'event-1',
	slug: 'naomi-huerta',
	eventType: 'xv' as const,
	rsvpDeadline: null as string | null,
};

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
	const error = await promise.then(
		() => null,
		(caught: unknown) => caught,
	);
	expect(error).toBeInstanceOf(ApiError);
	expect((error as ApiError).status).toBe(status);
	expect((error as ApiError).code).toBe(code);
}

describe('rsvp deadline service', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		sharingConfig.mockResolvedValue({
			eventDate: '2026-11-28',
			eventTimeZone: 'America/Chihuahua',
		});
		updateEventService.mockImplementation(async (input: { rsvpDeadline: string | null }) => ({
			...baseEvent,
			rsvpDeadline: input.rsvpDeadline,
		}));
	});

	it('rejects a deadline after the event date without saving', async () => {
		await expectApiError(
			updateRsvpDeadline({
				event: baseEvent,
				deadline: '2026-11-30',
				confirmPast: false,
				now: NOW,
			}),
			400,
			'bad_request',
		);
		expect(updateEventService).not.toHaveBeenCalled();
	});

	it('asks for confirmation before saving a past deadline', async () => {
		await expectApiError(
			updateRsvpDeadline({
				event: baseEvent,
				deadline: '2026-11-10',
				confirmPast: false,
				now: NOW,
			}),
			409,
			'deadline_in_past',
		);
		expect(updateEventService).not.toHaveBeenCalled();
	});

	it('saves a confirmed past deadline and reports RSVP as closed', async () => {
		const window = await updateRsvpDeadline({
			event: baseEvent,
			deadline: '2026-11-10',
			confirmPast: true,
			now: NOW,
		});
		expect(updateEventService).toHaveBeenCalledWith({
			eventId: 'event-1',
			rsvpDeadline: '2026-11-10',
		});
		expect(window).toEqual({
			deadline: '2026-11-10',
			label: '10 de noviembre de 2026',
			closed: true,
			eventDate: '2026-11-28',
			eventTimeZone: 'America/Chihuahua',
		});
	});

	it('clears the deadline with null', async () => {
		const window = await updateRsvpDeadline({
			event: { ...baseEvent, rsvpDeadline: '2026-11-20' },
			deadline: null,
			confirmPast: false,
			now: NOW,
		});
		expect(updateEventService).toHaveBeenCalledWith({ eventId: 'event-1', rsvpDeadline: null });
		expect(window.closed).toBe(false);
		expect(window.label).toBe('');
	});

	it('blocks RSVP once the deadline day ends in the event time zone', async () => {
		const event = { ...baseEvent, rsvpDeadline: '2026-11-15' };
		await expectApiError(assertRsvpOpen(event, NOW), 403, 'rsvp_closed');
		// 23:30 on Nov 15 in Chihuahua: still the deadline day.
		await expect(
			assertRsvpOpen(event, new Date('2026-11-16T05:30:00Z')),
		).resolves.toBeUndefined();
	});

	it('reopens RSVP after the host extends the deadline', async () => {
		const closed = { ...baseEvent, rsvpDeadline: '2026-11-15' };
		await expectApiError(assertRsvpOpen(closed, NOW), 403, 'rsvp_closed');

		const window = await updateRsvpDeadline({
			event: closed,
			deadline: '2026-11-25',
			confirmPast: false,
			now: NOW,
		});
		expect(window.closed).toBe(false);
		await expect(
			assertRsvpOpen({ ...closed, rsvpDeadline: window.deadline }, NOW),
		).resolves.toBeUndefined();
	});

	it('skips the content read for events without a deadline', async () => {
		await expect(assertRsvpOpen(baseEvent, NOW)).resolves.toBeUndefined();
		expect(sharingConfig).not.toHaveBeenCalled();
	});

	it('shows the deadline on the public invitation only when one is set', async () => {
		findEventBySlugService.mockResolvedValueOnce(baseEvent);
		await expect(loadPublicRsvpWindow('naomi-huerta', NOW)).resolves.toBeNull();

		findEventBySlugService.mockResolvedValueOnce({ ...baseEvent, rsvpDeadline: '2026-11-20' });
		await expect(loadPublicRsvpWindow('naomi-huerta', NOW)).resolves.toEqual({
			label: '20 de noviembre de 2026',
			closed: false,
		});
	});

	describe('shortening the deadline while guests are still pending', () => {
		const pendingGuest = {
			id: 'guest-1',
			inviteId: 'invite-1',
			eventId: 'event-1',
			maxAllowedAttendees: 2,
			maxAllowedChildren: 0,
			attendanceStatus: 'pending',
			guestComment: '',
		};

		beforeEach(() => {
			jest.useFakeTimers({ now: NOW });
			findGuestByInviteIdPublic.mockResolvedValue(pendingGuest);
			submitGuestRsvpPublicRpc.mockResolvedValue({
				...pendingGuest,
				attendanceStatus: 'confirmed',
				attendeeCount: 1,
				respondedAt: '2026-11-16T18:00:00Z',
				entrySource: 'host_created',
			});
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('lets a pending guest reply while the shorter deadline is still ahead', async () => {
			findEventByIdService.mockResolvedValue({ ...baseEvent, rsvpDeadline: '2026-11-16' });
			const result = await submitGuestRsvpByInviteId('invite-1', {
				attendanceStatus: 'confirmed',
				attendeeCount: 1,
			});
			expect(result.attendanceStatus).toBe('confirmed');
		});

		it('closes RSVP for pending guests once the shorter deadline has passed', async () => {
			const window = await updateRsvpDeadline({
				event: { ...baseEvent, rsvpDeadline: '2026-11-25' },
				deadline: '2026-11-12',
				confirmPast: true,
				now: NOW,
			});
			expect(window.closed).toBe(true);
			findEventByIdService.mockResolvedValue({ ...baseEvent, rsvpDeadline: window.deadline });
			await expectApiError(
				submitGuestRsvpByInviteId('invite-1', {
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
				}),
				403,
				'rsvp_closed',
			);
			expect(submitGuestRsvpPublicRpc).not.toHaveBeenCalled();
		});
	});
});
