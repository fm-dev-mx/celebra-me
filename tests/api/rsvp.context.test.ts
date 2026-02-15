import { clearRsvpMemoryStoreForTests, resetRsvpRepositoryForTests } from '@/lib/rsvp/repository';
import { createGuestToken } from '@/lib/rsvp/service';
import { GET } from '@/pages/api/rsvp/context';
import { EVENT_SLUG, TOKEN_SECRET, getMockEvents } from './rsvp.helpers';
import { getCollection } from 'astro:content';

const getCollectionMock = getCollection as jest.Mock;

describe('GET /api/rsvp/context', () => {
	const originalNodeEnv = process.env.NODE_ENV;

	beforeEach(() => {
		process.env.NODE_ENV = 'test';
		process.env.RSVP_TOKEN_SECRET = TOKEN_SECRET;
		getCollectionMock.mockResolvedValue(getMockEvents());
		resetRsvpRepositoryForTests();
		clearRsvpMemoryStoreForTests();
	});

	afterEach(() => {
		delete process.env.RSVP_TOKEN_SECRET;
		process.env.NODE_ENV = originalNodeEnv;
	});

	it('returns personalized context when token is valid', async () => {
		const token = createGuestToken({
			eventSlug: EVENT_SLUG,
			guestId: 'fam-mendoza-001',
		});
		const url = new URL(
			`http://localhost/api/rsvp/context?eventSlug=${EVENT_SLUG}&token=${encodeURIComponent(token)}`,
		);

		const response = await GET({ url } as never);
		const body = (await response.json()) as {
			mode: string;
			tokenValid: boolean;
			guest?: { displayName: string };
		};

		expect(response.status).toBe(200);
		expect(body.mode).toBe('personalized');
		expect(body.tokenValid).toBe(true);
		expect(body.guest?.displayName).toBe('Viridiana Mendoza');
	});

	it('returns generic fallback when token is invalid', async () => {
		const url = new URL(
			`http://localhost/api/rsvp/context?eventSlug=${EVENT_SLUG}&token=token-invalido`,
		);

		const response = await GET({ url } as never);
		const body = (await response.json()) as {
			mode: string;
			tokenValid: boolean;
			invalidTokenMessage?: string;
		};

		expect(response.status).toBe(200);
		expect(body.mode).toBe('generic');
		expect(body.tokenValid).toBe(false);
		expect(body.invalidTokenMessage).toMatch(/validar tu enlace personalizado/i);
	});

	it('fails fast in production when RSVP_TOKEN_SECRET is missing', () => {
		process.env.NODE_ENV = 'production';
		delete process.env.RSVP_TOKEN_SECRET;

		expect(() =>
			createGuestToken({
				eventSlug: EVENT_SLUG,
				guestId: 'fam-mendoza-001',
			}),
		).toThrow(/RSVP_TOKEN_SECRET es obligatorio en producción/i);
	});
});
