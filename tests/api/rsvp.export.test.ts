import { clearRsvpMemoryStoreForTests, resetRsvpRepositoryForTests } from '@/lib/rsvp/repository';
import { GET as getCsv } from '@/pages/api/rsvp/export.csv';
import { POST as postRsvp } from '@/pages/api/rsvp';
import { getCollection } from 'astro:content';
import {
	ADMIN_PASSWORD,
	ADMIN_USER,
	EVENT_SLUG,
	TOKEN_SECRET,
	buildBasicAuthHeader,
	createMockRequest,
	getMockEvents,
} from './rsvp.helpers';

const getCollectionMock = getCollection as jest.Mock;

describe('GET /api/rsvp/export.csv', () => {
	beforeEach(async () => {
		process.env.NODE_ENV = 'test';
		process.env.RSVP_TOKEN_SECRET = TOKEN_SECRET;
		process.env.RSVP_ADMIN_USER = ADMIN_USER;
		process.env.RSVP_ADMIN_PASSWORD = ADMIN_PASSWORD;
		getCollectionMock.mockResolvedValue(getMockEvents());
		resetRsvpRepositoryForTests();
		clearRsvpMemoryStoreForTests();

		const request = createMockRequest(
			{
				eventSlug: EVENT_SLUG,
				guestName: 'Apellido "Con comillas"',
				attendanceStatus: 'confirmed',
				attendeeCount: 2,
			},
			{ 'Content-Type': 'application/json' },
		);
		await postRsvp({ request } as never);
	});

	afterEach(() => {
		delete process.env.RSVP_TOKEN_SECRET;
		delete process.env.RSVP_ADMIN_USER;
		delete process.env.RSVP_ADMIN_PASSWORD;
	});

	it('requires basic auth', async () => {
		const url = new URL(`http://localhost/api/rsvp/export.csv?eventSlug=${EVENT_SLUG}`);
		const request = createMockRequest(undefined);
		const response = await getCsv({ url, request } as never);

		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toMatch(/basic/i);
	});

	it('exports CSV with expected columns and escaped values', async () => {
		const url = new URL(`http://localhost/api/rsvp/export.csv?eventSlug=${EVENT_SLUG}`);
		const request = createMockRequest(undefined, { authorization: buildBasicAuthHeader() });
		const response = await getCsv({ url, request } as never);
		const csv = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toMatch(/text\/csv/i);
		expect(csv).toContain(
			'rsvp_id,event_slug,name,source,status,attendee_count,possible_duplicate,created_at,updated_at,last_channel_action,last_channel_at',
		);
		expect(csv).toContain('"Apellido ""Con comillas"""');
	});
});
