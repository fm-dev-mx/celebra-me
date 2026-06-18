import { GET as getLocation } from '@/pages/api/invitacion/[inviteId]/location';
import { resolveGatedLocationPayload } from '@/lib/invitation/gated-location';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/invitation/gated-location', () => ({
	resolveGatedLocationPayload: jest.fn(),
}));

const resolveGatedLocationPayloadMock = resolveGatedLocationPayload as jest.MockedFunction<
	typeof resolveGatedLocationPayload
>;

describe('GET /api/invitacion/[inviteId]/location', () => {
	it('returns no-store headers and a confirmed location payload', async () => {
		resolveGatedLocationPayloadMock.mockResolvedValue({
			location: {
				visibility: 'after-rsvp',
				introHeading: 'Ubicación',
				ceremony: {
					venueEvent: 'Celebración',
					venueName: 'Salón García',
					address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
					date: '2026-08-01',
					time: '14:00',
					googleMapsUrl: 'https://maps.example.com/salon-garcia',
				},
			},
		});

		const response = await getLocation({
			params: { inviteId: 'mock-invite-id' },
			url: new URL(
				'http://localhost/api/invitacion/mock-invite-id/location?eventType=xv&slug=demo-xv-jewelry-box',
			),
			request: createMockRequest(undefined, undefined, 'http://localhost/api/test'),
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');

		const body = await response.json();
		expect(body).toMatchObject({
			success: true,
			data: {
				location: {
					introHeading: 'Ubicación',
					ceremony: { venueName: 'Salón García' },
				},
			},
		});
	});
});
