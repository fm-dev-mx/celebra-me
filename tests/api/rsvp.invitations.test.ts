import { GET as getInvitations } from '@/pages/api/rsvp/invitations';
import { getCollection } from 'astro:content';
import {
	ADMIN_PASSWORD,
	ADMIN_USER,
	EVENT_SLUG,
	buildBasicAuthHeader,
	createMockRequest,
	getMockEvents,
} from './rsvp.helpers';

const getCollectionMock = getCollection as jest.Mock;

describe('GET /api/rsvp/invitations', () => {
	beforeEach(() => {
		process.env.NODE_ENV = 'test';
		process.env.RSVP_TOKEN_SECRET = 'test-rsvp-secret';
		process.env.RSVP_ADMIN_USER = ADMIN_USER;
		process.env.RSVP_ADMIN_PASSWORD = ADMIN_PASSWORD;
		getCollectionMock.mockResolvedValue(getMockEvents());
	});

	afterEach(() => {
		delete process.env.RSVP_TOKEN_SECRET;
		delete process.env.RSVP_ADMIN_USER;
		delete process.env.RSVP_ADMIN_PASSWORD;
	});

	it('rejects unauthenticated requests', async () => {
		const url = new URL(`http://localhost/api/rsvp/invitations?eventSlug=${EVENT_SLUG}`);
		const request = createMockRequest(undefined);

		const response = await getInvitations({ url, request } as never);
		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toMatch(/basic/i);
	});

	it('returns 404 when event does not exist', async () => {
		const url = new URL('http://localhost/api/rsvp/invitations?eventSlug=no-existe');
		const request = createMockRequest(undefined, {
			authorization: buildBasicAuthHeader(ADMIN_USER, ADMIN_PASSWORD),
		});

		const response = await getInvitations({ url, request } as never);
		const body = (await response.json()) as { message?: string };
		expect(response.status).toBe(404);
		expect(body.message).toMatch(/no encontrado/i);
	});

	it('returns personalized and generic invitation links', async () => {
		const url = new URL(`http://localhost/api/rsvp/invitations?eventSlug=${EVENT_SLUG}`);
		const request = createMockRequest(undefined, {
			authorization: buildBasicAuthHeader(),
		});

		const response = await getInvitations({ url, request } as never);
		const body = (await response.json()) as {
			eventSlug: string;
			eventType: string;
			genericUrl: string;
			guests: Array<{
				guestId: string;
				personalizedUrl: string;
				waShareUrl: string;
				token: string;
			}>;
		};

		expect(response.status).toBe(200);
		expect(body.eventSlug).toBe(EVENT_SLUG);
		expect(body.eventType).toBe('cumple');
		expect(body.genericUrl).toContain('/cumple/gerardo-sesenta');
		expect(body.guests).toHaveLength(1);
		expect(body.guests[0]?.guestId).toBe('fam-mendoza-001');
		expect(body.guests[0]?.token).toBeTruthy();
		expect(body.guests[0]?.personalizedUrl).toContain('?t=');
		expect(body.guests[0]?.waShareUrl).toContain('wa.me/');
	});
});
