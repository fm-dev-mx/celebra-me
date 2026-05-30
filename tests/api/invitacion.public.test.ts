import { POST as publicRsvp } from '@/pages/api/invitacion/public/[eventType]/[slug]/rsvp';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { submitGuestRsvpByPublicEvent } from '@/lib/rsvp/services/rsvp-submission.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/invitation/content-resolver', () => ({
	resolveInvitationContent: jest.fn(),
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

import { resolveInvitationContent } from '@/lib/invitation/content-resolver';

const resolveInvitationContentMock = resolveInvitationContent as jest.MockedFunction<
	typeof resolveInvitationContent
>;
const findEventBySlugServiceMock = findEventBySlugService as jest.MockedFunction<
	typeof findEventBySlugService
>;
const submitGuestRsvpByPublicEventMock = submitGuestRsvpByPublicEvent as jest.MockedFunction<
	typeof submitGuestRsvpByPublicEvent
>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function mockContentResolution(overrides?: {
	accessMode?: string;
	guestCap?: number;
	isDemo?: boolean;
}) {
	const { accessMode = 'hybrid', guestCap = 3, isDemo = false } = overrides ?? {};
	return {
		source: 'static' as const,
		viewModel: {
			id: 'demo',
			isDemo,
			title: 'Evento Demo',
			theme: { preset: 'jewelry-box', themeClass: 'theme-preset--jewelry-box' },
			hero: { name: 'Demo', label: 'Evento', date: '2027-01-01' },
			envelope: { enabled: false },
			brandingVisibility: {
				showFooterBranding: true,
				showContactCta: true,
				showThankYouBranding: true,
			},
			sections: {
				rsvp: { guestCap, accessMode },
			},
		},
	};
}

describe('Invitation API: public landing RSVP', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		checkRateLimitMock.mockResolvedValue(true);
		resolveInvitationContentMock.mockResolvedValue(mockContentResolution() as any);
		findEventBySlugServiceMock.mockResolvedValue({
			id: 'evt-1',
			ownerUserId: 'host-1',
			slug: 'demo',
			eventType: 'xv',
			title: 'Evento Demo',
			status: 'published',
			publishedAt: new Date().toISOString(),
			invitationProjectId: null,
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
		resolveInvitationContentMock.mockResolvedValueOnce(
			mockContentResolution({ accessMode: 'personalized-only' }) as any,
		);

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
