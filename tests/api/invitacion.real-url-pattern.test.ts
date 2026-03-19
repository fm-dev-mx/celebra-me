import { POST } from '@/pages/api/invitacion/[inviteId]/rsvp';
import { submitGuestRsvpByInviteId } from '@/lib/rsvp/services/rsvp-submission.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp/service', () => ({
	submitGuestRsvpByInviteId: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

const submitGuestRsvpByInviteIdMock = submitGuestRsvpByInviteId as jest.MockedFunction<
	typeof submitGuestRsvpByInviteId
>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('Real URL Pattern: /[eventType]/[slug]/i/[shortId] → RSVP', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('handles RSVP submission for real invitation code pattern (38GG9K0Z)', async () => {
		// Simulate the real invitation code from the incident
		const invitationCode = '38GG9K0Z';

		checkRateLimitMock.mockResolvedValue(true);
		submitGuestRsvpByInviteIdMock.mockResolvedValue({
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			respondedAt: '2026-02-16T10:30:00Z',
		});

		const response = await POST({
			params: { inviteId: invitationCode },
			request: createMockRequest(
				{
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestMessage: 'Nos vemos en el evento!',
				},
				{ 'Content-Type': 'application/json' },
			),
		} as never);

		expect(response.status).toBe(200);
		expect(checkRateLimitMock).toHaveBeenCalledWith({
			namespace: 'rsvp',
			entityId: invitationCode,
			ip: 'unknown',
			maxHits: 20,
			windowSec: 60,
		});
		expect(submitGuestRsvpByInviteIdMock).toHaveBeenCalledWith(invitationCode, {
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			guestMessage: 'Nos vemos en el evento!',
		});

		const body = await response.json();
		expect(body).toEqual({
			success: true,
			data: {
				message: 'RSVP guardado.',
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
				respondedAt: '2026-02-16T10:30:00Z',
			},
		});
	});

	it('handles declined RSVP with invitation code', async () => {
		const invitationCode = 'TEST1234';

		checkRateLimitMock.mockResolvedValue(true);
		submitGuestRsvpByInviteIdMock.mockResolvedValue({
			attendanceStatus: 'declined',
			attendeeCount: 0,
			respondedAt: '2026-02-16T10:35:00Z',
		});

		const response = await POST({
			params: { inviteId: invitationCode },
			request: createMockRequest(
				{
					attendanceStatus: 'declined',
					attendeeCount: 0,
					guestMessage: 'Lamentablemente no podré asistir.',
				},
				{ 'Content-Type': 'application/json' },
			),
		} as never);

		expect(response.status).toBe(200);
		expect(submitGuestRsvpByInviteIdMock).toHaveBeenCalledWith(invitationCode, {
			attendanceStatus: 'declined',
			attendeeCount: 0,
			guestMessage: 'Lamentablemente no podré asistir.',
		});
	});

	it('returns 400 for invalid attendance status', async () => {
		const invitationCode = 'TEST1234';

		checkRateLimitMock.mockResolvedValue(true);

		const response = await POST({
			params: { inviteId: invitationCode },
			request: createMockRequest(
				{
					attendanceStatus: 'maybe', // Invalid status
					attendeeCount: 2,
				},
				{ 'Content-Type': 'application/json' },
			),
		} as never);

		expect(response.status).toBe(400);
		expect(submitGuestRsvpByInviteIdMock).not.toHaveBeenCalled();

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.message).toContain('attendanceStatus invalido');
	});

	it('returns 429 when rate limited', async () => {
		const invitationCode = 'TEST1234';

		checkRateLimitMock.mockResolvedValue(false); // Rate limited

		const response = await POST({
			params: { inviteId: invitationCode },
			request: createMockRequest(
				{
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
				},
				{ 'Content-Type': 'application/json' },
			),
		} as never);

		expect(response.status).toBe(429);
		expect(submitGuestRsvpByInviteIdMock).not.toHaveBeenCalled();

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.code).toBe('rate_limited');
	});

	it('returns 400 for missing Content-Type header', async () => {
		const invitationCode = 'TEST1234';

		const response = await POST({
			params: { inviteId: invitationCode },
			request: createMockRequest(
				{
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
				},
				{ 'Content-Type': '' }, // Empty content-type
			),
		} as never);

		expect(response.status).toBe(400);
		expect(checkRateLimitMock).not.toHaveBeenCalled();

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.message).toContain('Content-Type must be application/json');
	});

	it('returns 400 for empty request body', async () => {
		const invitationCode = 'TEST1234';

		checkRateLimitMock.mockResolvedValue(true);

		const response = await POST({
			params: { inviteId: invitationCode },
			request: createMockRequest(
				'', // Empty body
				{ 'Content-Type': 'application/json' },
			),
		} as never);

		expect(response.status).toBe(400);
		expect(submitGuestRsvpByInviteIdMock).not.toHaveBeenCalled();

		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error.message).toContain('Request body is empty');
	});
});
