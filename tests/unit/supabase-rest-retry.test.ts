import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/server/supabase-credentials', () => ({
	getSupabaseUrl: () => 'https://test.supabase.co',
	getSupabaseAnonKey: () => 'test-anon-key',
	getSupabaseServiceRoleKey: () => 'test-service-role-key',
}));

/** Helper: create a PostgREST error response body. */
function pgErrorBody(code: string, message: string): string {
	return JSON.stringify({ code, message, details: 'diagnostic detail' });
}

/** A 401 body with PGRST303 and the exact message we retry on. */
const JWT_FUTURE_BODY = pgErrorBody('PGRST303', 'JWT issued at future');

/** Helper: build a fetch mock that returns the given response on each call. */
function mockFetchSequence(...responses: Partial<Response>[]): void {
	const iter = responses[Symbol.iterator]();
	(global.fetch as jest.Mock).mockImplementation(async () => {
		const next = iter.next();
		if (next.done) {
			throw new Error('Unexpected fetch call — no more mocked responses');
		}
		return next.value as Response;
	});
}

function okResponse(body = '[]'): Partial<Response> {
	return {
		ok: true,
		status: 200,
		headers: new Headers({ 'Content-Type': 'application/json' }),
		text: async () => body,
	};
}

function errorResponse(status: number, body: string): Partial<Response> {
	return {
		ok: false,
		status,
		statusText: status === 401 ? 'Unauthorized' : 'Error',
		headers: new Headers({ 'Content-Type': 'application/json' }),
		text: async () => body,
	};
}

// ---------------------------------------------------------------------------
// Shared options
// ---------------------------------------------------------------------------

const authGetOptions = {
	pathWithQuery: 'events?select=id',
	method: 'GET' as const,
	authToken: 'valid-jwt-token',
	useServiceRole: false,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	// Reset fetch call count — setup.ts assigns global.fetch as a bare
	// jest.fn() (not spyOn), so jest.restoreAllMocks() does not clear it.
	(global.fetch as jest.Mock).mockClear();
	jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests — first GET fails with matching PGRST303, retry succeeds
// ---------------------------------------------------------------------------

describe('JWT future retry', () => {
	it('retries a matching PGRST303 GET and succeeds on second attempt', async () => {
		mockFetchSequence(
			errorResponse(401, JWT_FUTURE_BODY),
			okResponse(JSON.stringify([{ id: 1 }])),
		);

		const result = await supabaseRestRequest(authGetOptions);

		expect(result).toEqual([{ id: 1 }]);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	}, 10_000);

	it('stops retrying after max attempts and throws the original SupabaseHttpError', async () => {
		mockFetchSequence(
			errorResponse(401, JWT_FUTURE_BODY),
			errorResponse(401, JWT_FUTURE_BODY),
			errorResponse(401, JWT_FUTURE_BODY),
		);

		let error: unknown;
		try {
			await supabaseRestRequest(authGetOptions);
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(SupabaseHttpError);
		expect((error as SupabaseHttpError).status).toBe(401);
		expect((error as SupabaseHttpError).code).toBe('PGRST303');
		expect((error as SupabaseHttpError).body).toContain('JWT issued at future');
		expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
	}, 10_000);
});

// ---------------------------------------------------------------------------
// Tests — unrelated PGRST303 messages are not retried
// ---------------------------------------------------------------------------

describe('unrelated PGRST303 messages', () => {
	it('does not retry PGRST303 with a different message', async () => {
		const otherBody = pgErrorBody('PGRST303', 'JWT expired');
		mockFetchSequence(errorResponse(401, otherBody));

		await expect(supabaseRestRequest(authGetOptions)).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry PGRST303 with null/undefined message', async () => {
		const noMsgBody = JSON.stringify({ code: 'PGRST303' });
		mockFetchSequence(errorResponse(401, noMsgBody));

		await expect(supabaseRestRequest(authGetOptions)).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Tests — other 401 responses are not retried
// ---------------------------------------------------------------------------

describe('other 401 responses', () => {
	it('does not retry a 401 with a non-PGRST303 code', async () => {
		const invalidBody = pgErrorBody('PGRST300', 'Some error');
		mockFetchSequence(errorResponse(401, invalidBody));

		await expect(supabaseRestRequest(authGetOptions)).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry a 401 with unparseable body', async () => {
		mockFetchSequence(errorResponse(401, 'not json'));

		await expect(supabaseRestRequest(authGetOptions)).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Tests — service-role calls are not retried
// ---------------------------------------------------------------------------

describe('service-role calls', () => {
	it('does not retry PGRST303 when useServiceRole is true', async () => {
		mockFetchSequence(errorResponse(401, JWT_FUTURE_BODY));

		await expect(
			supabaseRestRequest({
				...authGetOptions,
				useServiceRole: true,
			}),
		).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry PGRST303 when authToken is empty', async () => {
		mockFetchSequence(errorResponse(401, JWT_FUTURE_BODY));

		await expect(
			supabaseRestRequest({
				...authGetOptions,
				authToken: '',
			}),
		).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry PGRST303 when authToken is only whitespace', async () => {
		mockFetchSequence(errorResponse(401, JWT_FUTURE_BODY));

		await expect(
			supabaseRestRequest({
				...authGetOptions,
				authToken: '   ',
			}),
		).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Tests — mutations are not retried
// ---------------------------------------------------------------------------

describe('mutation methods', () => {
	it('does not retry PGRST303 on POST', async () => {
		mockFetchSequence(errorResponse(401, JWT_FUTURE_BODY));

		await expect(
			supabaseRestRequest({
				...authGetOptions,
				method: 'POST',
				body: { name: 'test' },
			}),
		).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry PGRST303 on PATCH', async () => {
		mockFetchSequence(errorResponse(401, JWT_FUTURE_BODY));

		await expect(
			supabaseRestRequest({
				...authGetOptions,
				method: 'PATCH',
				body: { name: 'updated' },
			}),
		).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('does not retry PGRST303 on DELETE', async () => {
		mockFetchSequence(errorResponse(401, JWT_FUTURE_BODY));

		await expect(
			supabaseRestRequest({
				...authGetOptions,
				method: 'DELETE',
			}),
		).rejects.toThrow(SupabaseHttpError);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Tests — no token appears in logs
// ---------------------------------------------------------------------------

describe('log diagnostic safety', () => {
	it('never logs the JWT or bearer token in warn output', async () => {
		mockFetchSequence(
			errorResponse(401, JWT_FUTURE_BODY),
			okResponse(JSON.stringify([{ id: 1 }])),
		);

		await supabaseRestRequest(authGetOptions);

		const warnCalls = (console.warn as jest.Mock).mock.calls.map((args: unknown[]) =>
			args.join(' '),
		);

		// Should have at least one diagnostic log
		expect(warnCalls.length).toBeGreaterThanOrEqual(1);

		for (const msg of warnCalls) {
			expect(msg).not.toContain('valid-jwt-token');
			expect(msg).not.toContain('Bearer');
			expect(msg).not.toContain('jwt');
			expect(msg).not.toContain('cookie');
		}
	}, 10_000);
});

// ---------------------------------------------------------------------------
// Tests — success path still works (no regression)
// ---------------------------------------------------------------------------

describe('no-regression success path', () => {
	it('returns data on first success without retry', async () => {
		mockFetchSequence(okResponse(JSON.stringify([{ id: 1, name: 'event' }])));

		const result = await supabaseRestRequest({
			pathWithQuery: 'events?select=id,name',
			method: 'GET',
		});

		expect(result).toEqual([{ id: 1, name: 'event' }]);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('returns empty array for 2xx with empty body', async () => {
		mockFetchSequence(okResponse(''));

		const result = await supabaseRestRequest({
			pathWithQuery: 'events?select=id',
			method: 'GET',
		});

		expect(result).toEqual([]);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});
