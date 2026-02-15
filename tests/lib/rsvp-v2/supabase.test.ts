import { supabaseRestRequest } from '@/lib/rsvp-v2/supabase';

describe('rsvp-v2 supabase rest client', () => {
	const originalEnv = { ...process.env };
	const originalFetch = global.fetch;

	beforeEach(() => {
		process.env.SUPABASE_URL = 'https://project.supabase.co';
		process.env.SUPABASE_ANON_KEY = 'anon';
		process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it('throws when response is not ok', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: async () => 'bad token',
		}) as typeof fetch;

		await expect(
			supabaseRestRequest({
				pathWithQuery: 'events?select=*',
				authToken: 'invalid',
			}),
		).rejects.toThrow('Supabase error (401)');
	});

	it('returns empty array for 204', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 204,
			json: async () => [],
		}) as typeof fetch;

		const result = await supabaseRestRequest<{ id: string }[]>({
			pathWithQuery: 'events?select=*',
			authToken: 'token',
		});
		expect(result).toEqual([]);
	});
});
