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

describe('rsvp-v2 auth', () => {
	const originalFetch = global.fetch;
	const originalEnv = { ...process.env };

	afterEach(() => {
		global.fetch = originalFetch;
		process.env = { ...originalEnv };
		jest.restoreAllMocks();
	});

	it('extracts bearer token from authorization header', () => {
		const request = createRequest({
			authorization: 'Bearer token-123',
		});
		expect(resolveAccessTokenFromRequest(request)).toBe('token-123');
	});

	it('extracts token from supabase auth cookie', () => {
		const token = 'cookie-token';
		const cookiePayload = encodeURIComponent(JSON.stringify({ access_token: token }));
		const request = createRequest({
			cookie: `sb-test-auth-token=${cookiePayload}`,
		});
		expect(resolveAccessTokenFromRequest(request)).toBe(token);
	});

	it('returns session when supabase user endpoint validates token', async () => {
		process.env.SUPABASE_URL = 'https://project.supabase.co';
		process.env.SUPABASE_ANON_KEY = 'anon';

		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: 'host-1', email: 'host@test.com' }),
		}) as typeof fetch;

		const request = createRequest({
			authorization: 'Bearer token-123',
		});

		const session = await getHostSessionFromRequest(request);
		expect(session?.userId).toBe('host-1');
		expect(session?.accessToken).toBe('token-123');
	});
});
