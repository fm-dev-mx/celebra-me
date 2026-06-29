import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

describe('rsvp supabase rest client', () => {
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
			text: async () => '',
		}) as typeof fetch;

		const result = await supabaseRestRequest<{ id: string }[]>({
			pathWithQuery: 'events?select=*',
			authToken: 'token',
		});
		expect(result).toEqual([]);
	});

	it('returns empty array for 201 with empty body (return=minimal)', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 201,
			text: async () => '',
		}) as typeof fetch;

		const result = await supabaseRestRequest<{ id: string }[]>({
			pathWithQuery: 'visitor_sessions?on_conflict=id',
			method: 'POST',
			prefer: 'resolution=merge-duplicates,return=minimal',
			body: { id: 'test' },
			authToken: 'token',
		});
		expect(result).toEqual([]);
	});

	it('returns empty array for 200 with empty body', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => '',
		}) as typeof fetch;

		const result = await supabaseRestRequest<{ id: string }[]>({
			pathWithQuery: 'events?select=*',
			authToken: 'token',
		});
		expect(result).toEqual([]);
	});

	it('parses valid JSON body from 201 response', async () => {
		const rows = [{ id: 'evt-1', event_name: 'page_viewed' }];
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 201,
			text: async () => JSON.stringify(rows),
		}) as typeof fetch;

		const result = await supabaseRestRequest<Array<{ id: string; event_name: string }>>({
			pathWithQuery: 'tracking_events?select=id,event_name',
			method: 'POST',
			prefer: 'return=representation',
			body: { event_name: 'page_viewed' },
			authToken: 'token',
		});
		expect(result).toEqual([{ id: 'evt-1', event_name: 'page_viewed' }]);
	});

	it('throws descriptive error for 200 with non-empty invalid JSON body', async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: async () => '<html>Server error</html>',
		}) as typeof fetch;

		await expect(
			supabaseRestRequest<unknown[]>({
				pathWithQuery: 'tracking_events?select=id',
				method: 'GET',
				authToken: 'token',
			}),
		).rejects.toThrow(
			'Supabase response parse error (200 GET /rest/v1/tracking_events?select=id): invalid JSON body',
		);
	});
});
