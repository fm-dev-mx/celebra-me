import { clearRsvpMemoryStoreForTests, resetRsvpRepositoryForTests } from '@/lib/rsvp/repository';
import { POST as postChannel } from '@/pages/api/rsvp/channel';
import { POST as postRsvp } from '@/pages/api/rsvp';
import { getCollection } from 'astro:content';
import { EVENT_SLUG, TOKEN_SECRET, createMockRequest, getMockEvents } from './rsvp.helpers';

const getCollectionMock = getCollection as jest.Mock;

async function createRsvp(): Promise<string> {
	const request = createMockRequest(
		{
			eventSlug: EVENT_SLUG,
			guestName: 'Invitado Canal',
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
		},
		{ 'Content-Type': 'application/json' },
	);
	const response = await postRsvp({ request } as never);
	const body = (await response.json()) as { rsvpId: string };
	return body.rsvpId;
}

describe('POST /api/rsvp/channel', () => {
	beforeEach(() => {
		process.env.NODE_ENV = 'test';
		process.env.RSVP_TOKEN_SECRET = TOKEN_SECRET;
		getCollectionMock.mockResolvedValue(getMockEvents());
		resetRsvpRepositoryForTests();
		clearRsvpMemoryStoreForTests();
	});

	afterEach(() => {
		delete process.env.RSVP_TOKEN_SECRET;
	});

	it('accepts cta_rendered and clicked actions for existing RSVP', async () => {
		const rsvpId = await createRsvp();
		for (const action of ['cta_rendered', 'clicked']) {
			const request = createMockRequest(
				{
					rsvpId,
					channel: 'whatsapp',
					action,
				},
				{ 'Content-Type': 'application/json' },
			);
			const response = await postChannel({ request } as never);
			expect(response.status).toBe(200);
		}
	});

	it('returns 404 when RSVP does not exist', async () => {
		const request = createMockRequest(
			{
				rsvpId: 'rsvp_inexistente',
				channel: 'whatsapp',
				action: 'clicked',
			},
			{ 'Content-Type': 'application/json' },
		);
		const response = await postChannel({ request } as never);
		expect(response.status).toBe(404);
	});
});
