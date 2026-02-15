import { clearRsvpMemoryStoreForTests, resetRsvpRepositoryForTests } from '@/lib/rsvp/repository';
import { createGuestToken } from '@/lib/rsvp/service';
import { POST } from '@/pages/api/rsvp';
import { getCollection } from 'astro:content';
import { EVENT_SLUG, TOKEN_SECRET, createMockRequest, getMockEvents } from './rsvp.helpers';

const getCollectionMock = getCollection as jest.Mock;

async function postRsvp(payload: Record<string, unknown>): Promise<Response> {
	const request = createMockRequest(payload, { 'Content-Type': 'application/json' });
	return await POST({ request } as never);
}

describe('POST /api/rsvp', () => {
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

	it('supports canonical and legacy payloads', async () => {
		const canonical = await postRsvp({
			eventSlug: EVENT_SLUG,
			guestName: 'Invitado Canonico',
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
		});
		const legacy = await postRsvp({
			eventSlug: EVENT_SLUG,
			name: 'Invitado Legado',
			attendance: 'yes',
			guestCount: 1,
		});

		expect(canonical.status).toBe(200);
		expect(legacy.status).toBe(200);
	});

	it('enforces declined attendee count as zero and keeps last response', async () => {
		const token = createGuestToken({
			eventSlug: EVENT_SLUG,
			guestId: 'fam-mendoza-001',
		});
		const first = await postRsvp({
			eventSlug: EVENT_SLUG,
			token,
			attendanceStatus: 'confirmed',
			attendeeCount: 3,
		});
		const firstBody = (await first.json()) as { rsvpId: string; status: string };

		const second = await postRsvp({
			eventSlug: EVENT_SLUG,
			token,
			attendanceStatus: 'declined',
			attendeeCount: 5,
		});
		const secondBody = (await second.json()) as {
			rsvpId: string;
			status: string;
			whatsappTemplatePayload: { attendeeCount: number };
		};

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(secondBody.rsvpId).toBe(firstBody.rsvpId);
		expect(secondBody.status).toBe('declined');
		expect(secondBody.whatsappTemplatePayload.attendeeCount).toBe(0);
	});
});
