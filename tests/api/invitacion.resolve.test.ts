import { GET } from '@/pages/api/invitacion/resolve';
import { resolveLegacyTokenToCanonicalUrl } from '@/lib/rsvp/services/invitation-context.service';

jest.mock('@/lib/rsvp/service', () => ({
	resolveLegacyTokenToCanonicalUrl: jest.fn(),
}));

const resolveLegacyTokenToCanonicalUrlMock =
	resolveLegacyTokenToCanonicalUrl as jest.MockedFunction<
		typeof resolveLegacyTokenToCanonicalUrl
	>;

describe('GET /api/invitacion/resolve', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 400 when query params are missing', async () => {
		const response = await GET({
			url: new URL('http://localhost/api/invitacion/resolve'),
		} as never);
		expect(response.status).toBe(400);
	});

	it('returns 404 when token cannot be resolved', async () => {
		resolveLegacyTokenToCanonicalUrlMock.mockResolvedValue(null);
		const response = await GET({
			url: new URL('http://localhost/api/invitacion/resolve?eventSlug=evt&token=abc'),
		} as never);
		expect(response.status).toBe(404);
	});

	it('returns canonical URL when token resolves', async () => {
		resolveLegacyTokenToCanonicalUrlMock.mockResolvedValue(
			'http://localhost/invitacion/uuid-test',
		);
		const response = await GET({
			url: new URL('http://localhost/api/invitacion/resolve?eventSlug=evt&token=abc'),
		} as never);
		const body = (await response.json()) as { canonicalUrl: string };
		expect(response.status).toBe(200);
		expect(body.canonicalUrl).toContain('/invitacion/');
	});
});
