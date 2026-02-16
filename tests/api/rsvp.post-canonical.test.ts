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

async function postRsvpWithInvalidJson(): Promise<Response> {
	const request = {
		json: async () => {
			throw new Error('Unexpected end of JSON input');
		},
		text: async () => {
			throw new Error('Unexpected end of JSON input');
		},
		headers: {
			get: (name: string) =>
				name.toLowerCase() === 'content-type' ? 'application/json' : null,
		} as Headers,
	};
	return await POST({ request } as never);
}

async function postRsvpWithoutContentType(payload: Record<string, unknown>): Promise<Response> {
	const request = createMockRequest(payload, { 'Content-Type': '' });
	return await POST({ request } as never);
}

async function postRsvpWithNonObjectJson(): Promise<Response> {
	const request = createMockRequest('invalid-json-string', {
		'Content-Type': 'application/json',
	});
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
		const firstBody = (await first.json()) as {
			success: true;
			data: { rsvpId: string; status: string };
		};

		const second = await postRsvp({
			eventSlug: EVENT_SLUG,
			token,
			attendanceStatus: 'declined',
			attendeeCount: 5,
		});
		const secondBody = (await second.json()) as {
			success: true;
			data: {
				rsvpId: string;
				status: string;
				whatsappTemplatePayload: { attendeeCount: number };
			};
		};

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(secondBody.data.rsvpId).toBe(firstBody.data.rsvpId);
		expect(secondBody.data.status).toBe('declined');
		expect(secondBody.data.whatsappTemplatePayload.attendeeCount).toBe(0);
	});

	it('returns 400 for invalid JSON format', async () => {
		const response = await postRsvpWithInvalidJson();
		expect(response.status).toBe(400);

		const body = (await response.json()) as {
			success: false;
			error: { code: string; message: string };
		};
		expect(body.error.message).toContain('Failed to read request body');
	});

	it('returns 400 for missing Content-Type header', async () => {
		const response = await postRsvpWithoutContentType({
			eventSlug: EVENT_SLUG,
			attendanceStatus: 'confirmed',
		});
		expect(response.status).toBe(400);

		const body = (await response.json()) as {
			success: false;
			error: { code: string; message: string };
		};
		expect(body.error.message).toBe('Content-Type must be application/json');
	});

	it('returns 400 for non-object JSON', async () => {
		const response = await postRsvpWithNonObjectJson();
		expect(response.status).toBe(400);

		const body = (await response.json()) as {
			success: false;
			error: { code: string; message: string };
		};
		// Ahora devuelve error de parsing JSON porque "invalid-json-string" no es JSON válido
		expect(body.error.message).toContain('Invalid JSON format');
	});
});
