import { getHostSessionFromRequest, resolveAccessTokenFromRequest } from '@/lib/rsvp-v2/auth';

function createRequest(headers: Record<string, string>): Request {
	const normalized = Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
	);
	return {
		headers: {
			get: (name: string) => normalized[name.toLowerCase()] ?? null,
		},
	} as unknown as Request;
}

describe('rsvp-v2 auth session edge cases', () => {
	const originalFetch = global.fetch;
	const originalEnv = { ...process.env };

	afterEach(() => {
		global.fetch = originalFetch;
		process.env = { ...originalEnv };
		jest.restoreAllMocks();
	});

	it('returns empty token when request has no auth headers', () => {
		const request = createRequest({});
		expect(resolveAccessTokenFromRequest(request)).toBe('');
	});

	it('returns null session for invalid token response', async () => {
		process.env.SUPABASE_URL = 'https://project.supabase.co';
		process.env.SUPABASE_ANON_KEY = 'anon';
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			json: async () => ({}),
		}) as typeof fetch;

		const session = await getHostSessionFromRequest(
			createRequest({
				authorization: 'Bearer invalid',
			}),
		);
		expect(session).toBeNull();
	});
});
