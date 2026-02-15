import { clearRsvpMemoryStoreForTests, resetRsvpRepositoryForTests } from '@/lib/rsvp/repository';
import { GET as getAdmin } from '@/pages/api/rsvp/admin';
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

describe('GET /api/rsvp/admin', () => {
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
				guestName: 'Viridiana Mendoza',
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

	it('rejects requests without basic auth', async () => {
		const url = new URL(`http://localhost/api/rsvp/admin?eventSlug=${EVENT_SLUG}`);
		const request = createMockRequest(undefined);

		const response = await getAdmin({ url, request } as never);
		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toMatch(/basic/i);
	});

	it('returns filtered admin list with valid basic auth', async () => {
		const url = new URL(
			`http://localhost/api/rsvp/admin?eventSlug=${EVENT_SLUG}&status=confirmed&search=viri`,
		);
		const request = createMockRequest(undefined, { authorization: buildBasicAuthHeader() });
		const response = await getAdmin({ url, request } as never);
		const body = (await response.json()) as { items: Array<{ guestNameEntered: string }> };

		expect(response.status).toBe(200);
		expect(body.items).toHaveLength(1);
		expect(body.items[0]?.guestNameEntered).toBe('Viridiana Mendoza');
	});
});
