import {
	GET as getDashboardGuests,
	POST as postDashboardGuest,
} from '@/pages/api/dashboard/guests';
import { GET as getDashboardEvents } from '@/pages/api/dashboard/events';
import { GET as getInvitationContext } from '@/pages/api/invitacion/[inviteId]/context';
import { POST as postInvitationRsvp } from '@/pages/api/invitacion/[inviteId]/rsvp';
import { createMockRequest } from './rsvp.helpers';

describe('RSVP v2 endpoint baseline', () => {
	it('rejects dashboard list without host session', async () => {
		const request = createMockRequest();
		const url = new URL('http://localhost/api/dashboard/guests?eventId=evt-1');

		const response = await getDashboardGuests({ request, url } as never);
		expect(response.status).toBe(401);
	});

	it('rejects dashboard create without host session', async () => {
		const request = createMockRequest({
			eventId: 'evt-1',
			fullName: 'Invitado Demo',
			phoneE164: '+5216680000000',
			maxAllowedAttendees: 2,
		});
		const url = new URL('http://localhost/api/dashboard/guests');

		const response = await postDashboardGuest({ request, url } as never);
		expect(response.status).toBe(401);
	});

	it('rejects dashboard events list without host session', async () => {
		const request = createMockRequest();
		const response = await getDashboardEvents({ request } as never);
		expect(response.status).toBe(401);
	});

	it('returns bad request on invitation context when inviteId is missing', async () => {
		const request = createMockRequest();
		const response = await getInvitationContext({ params: {}, request } as never);
		expect(response.status).toBe(400);
	});

	it('returns bad request on invitation rsvp with invalid status', async () => {
		const inviteId = `test-${Date.now()}`;
		const request = createMockRequest({
			attendanceStatus: 'pending',
			attendeeCount: 1,
		});
		const response = await postInvitationRsvp({ params: { inviteId }, request } as never);
		expect(response.status).toBe(400);
	});
});
