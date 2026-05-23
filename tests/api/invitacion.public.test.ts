import { POST as publicRsvp } from '@/pages/api/invitacion/public/[eventType]/[slug]/rsvp';
import { getRoutableEventEntry } from '@/lib/content/events';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { submitGuestRsvpByPublicEvent } from '@/lib/rsvp/services/rsvp-submission.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/content/events', () => ({
	getRoutableEventEntry: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/rsvp-submission.service', () => ({
	submitGuestRsvpByPublicEvent: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

const getRoutableEventEntryMock = getRoutableEventEntry as jest.MockedFunction<
	typeof getRoutableEventEntry
>;
const findEventBySlugServiceMock = findEventBySlugService as jest.MockedFunction<
	typeof findEventBySlugService
>;
const submitGuestRsvpByPublicEventMock = submitGuestRsvpByPublicEvent as jest.MockedFunction<
	typeof submitGuestRsvpByPublicEvent
>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('Invitation API: public landing RSVP', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		checkRateLimitMock.mockResolvedValue(true);
		getRoutableEventEntryMock.mockResolvedValue({
			id: 'events/demo',
			data: {
				eventType: 'xv',
				isDemo: false,
				rsvp: {
					guestCap: 3,
					accessMode: 'hybrid',
				},
			},
		} as never);
		findEventBySlugServiceMock.mockResolvedValue({
			id: 'evt-1',
			ownerUserId: 'host-1',
			slug: 'demo',
			eventType: 'xv',
			title: 'Evento Demo',
			status: 'published',
			publishedAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	});

	it('accepts a hybrid public RSVP submission', async () => {
		submitGuestRsvpByPublicEventMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			respondedAt: new Date().toISOString(),
			inviteId: 'invite-1',
			guestId: 'guest-1',
			entrySource: 'generic_public',
		});

		const response = await publicRsvp({
			params: { eventType: 'xv', slug: 'demo' },
			request: createMockRequest(
				{
					fullName: 'Mariana Soto',
					phone: '668 000 0000',
					countryCode: '+52',
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
				},
				{ 'Content-Type': 'application/json', 'x-real-ip': '127.0.0.1' },
			),
		} as never);

		expect(response.status).toBe(200);
		expect(submitGuestRsvpByPublicEventMock).toHaveBeenCalledWith(
			expect.objectContaining({
				fullName: 'Mariana Soto',
				phone: '6680000000',
				countryCode: '+52',
				maxAllowedAttendees: 3,
			}),
		);
	});

	it('passes through a non-MX countryCode when provided', async () => {
		submitGuestRsvpByPublicEventMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 1,
			respondedAt: new Date().toISOString(),
			inviteId: 'invite-3',
			guestId: 'guest-3',
			entrySource: 'generic_public',
		});

		await publicRsvp({
			params: { eventType: 'xv', slug: 'demo' },
			request: createMockRequest(
				{
					fullName: 'John Smith',
					phone: '5551234567',
					countryCode: '+1',
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
				},
				{ 'Content-Type': 'application/json', 'x-real-ip': '127.0.0.1' },
			),
		} as never);

		expect(submitGuestRsvpByPublicEventMock).toHaveBeenCalledWith(
			expect.objectContaining({ countryCode: '+1' }),
		);
	});

	it('strips countryCode when phone is empty but countryCode is provided', async () => {
		submitGuestRsvpByPublicEventMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 1,
			respondedAt: new Date().toISOString(),
			inviteId: 'invite-5',
			guestId: 'guest-5',
			entrySource: 'generic_public',
		});

		await publicRsvp({
			params: { eventType: 'xv', slug: 'demo' },
			request: createMockRequest(
				{
					fullName: 'Carlos Ruiz',
					phone: '',
					countryCode: '+34',
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
				},
				{ 'Content-Type': 'application/json', 'x-real-ip': '127.0.0.1' },
			),
		} as never);

		const callArg = submitGuestRsvpByPublicEventMock.mock.calls[0][0];
		expect(callArg.phone).toBe('');
		expect(callArg.countryCode).toBeUndefined();
	});

	it('does not pass countryCode when phone is empty', async () => {
		submitGuestRsvpByPublicEventMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 1,
			respondedAt: new Date().toISOString(),
			inviteId: 'invite-4',
			guestId: 'guest-4',
			entrySource: 'generic_public',
		});

		await publicRsvp({
			params: { eventType: 'xv', slug: 'demo' },
			request: createMockRequest(
				{
					fullName: 'Ana López',
					phone: '',
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
				},
				{ 'Content-Type': 'application/json', 'x-real-ip': '127.0.0.1' },
			),
		} as never);

		const callArg = submitGuestRsvpByPublicEventMock.mock.calls[0][0];
		expect(callArg.phone).toBe('');
		expect(callArg.countryCode).toBeUndefined();
	});

	it('rejects events that do not opt into hybrid RSVP', async () => {
		getRoutableEventEntryMock.mockResolvedValueOnce({
			id: 'events/demo',
			data: {
				eventType: 'xv',
				isDemo: false,
				rsvp: {
					guestCap: 3,
					accessMode: 'personalized-only',
				},
			},
		} as never);

		const response = await publicRsvp({
			params: { eventType: 'xv', slug: 'demo' },
			request: createMockRequest({
				fullName: 'Mariana Soto',
				phone: '6680000000',
				countryCode: '+52',
				attendanceStatus: 'confirmed',
				attendeeCount: 1,
			}),
		} as never);

		expect(response.status).toBe(403);
	});

	it('rejects public phone submissions without countryCode', async () => {
		const response = await publicRsvp({
			params: { eventType: 'xv', slug: 'demo' },
			request: createMockRequest(
				{
					fullName: 'Mariana Soto',
					phone: '6680000000',
					attendanceStatus: 'confirmed',
					attendeeCount: 1,
				},
				{ 'Content-Type': 'application/json', 'x-real-ip': '127.0.0.1' },
			),
		} as never);

		expect(response.status).toBe(400);
		expect(submitGuestRsvpByPublicEventMock).not.toHaveBeenCalled();
	});
});
