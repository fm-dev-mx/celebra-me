import {
	getHostSessionFromRequest,
	getSupabaseUserByAccessToken,
	resolveAccessTokenFromRequest,
} from '@/lib/rsvp/auth/auth';

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

describe('rsvp auth', () => {
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

	it('makes no Auth call when the request has no token', async () => {
		global.fetch = jest.fn() as typeof fetch;

		const session = await getHostSessionFromRequest(createRequest({}));

		expect(session).toBeNull();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it.each([400, 401, 403])(
		'returns null for a confirmed HTTP %s credential rejection',
		async (status) => {
			process.env.SUPABASE_URL = 'https://project.supabase.co';
			process.env.SUPABASE_ANON_KEY = 'anon';
			global.fetch = jest.fn().mockResolvedValue({ ok: false, status }) as typeof fetch;

			await expect(getSupabaseUserByAccessToken('rejected-token')).resolves.toBeNull();
		},
	);

	it('propagates transient Auth failures instead of treating them as logout', async () => {
		process.env.SUPABASE_URL = 'https://project.supabase.co';
		process.env.SUPABASE_ANON_KEY = 'anon';
		global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as typeof fetch;

		await expect(getSupabaseUserByAccessToken('valid-session-token')).rejects.toMatchObject({
			kind: 'http',
			status: 503,
			retryable: true,
		});
	});
});
