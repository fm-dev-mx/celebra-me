import { ApiError } from '@/lib/rsvp/core/errors';
import { setCsrfToken, validateCsrfToken } from '@/lib/rsvp/security/csrf';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

function createCookies(initialToken?: string) {
	let token = initialToken;
	return {
		cookies: {
			get: jest.fn(() => (token ? { value: token } : undefined)),
			set: jest.fn((_name: string, value: string) => {
				token = value;
			}),
			delete: jest.fn(() => {
				token = undefined;
			}),
		},
		getToken: () => token,
	};
}

function mutationRequest(token?: string): Request {
	return new Request('https://www.celebra-me.com/api/dashboard/test', {
		method: 'POST',
		headers: token ? { 'x-csrf-token': token } : {},
	});
}

describe('CSRF token lifecycle', () => {
	it('reuses one token for separately loaded dashboard tabs', () => {
		const { cookies, getToken } = createCookies();
		const tabAToken = setCsrfToken(cookies as never);
		const tabBToken = setCsrfToken(cookies as never);

		expect(tabBToken).toBe(tabAToken);
		expect(getToken()).toBe(tabAToken);
		validateCsrfToken(mutationRequest(tabAToken), cookies as never);
	});

	it('rejects forged and missing tokens for authenticated mutations', () => {
		const { cookies } = createCookies('valid-token');

		expect(() => validateCsrfToken(mutationRequest('forged-token'), cookies as never)).toThrow(
			ApiError,
		);
		expect(() => validateCsrfToken(mutationRequest(), cookies as never)).toThrow(ApiError);
	});

	it('rejects a missing CSRF cookie instead of silently disabling protection', () => {
		const { cookies } = createCookies();

		try {
			validateCsrfToken(mutationRequest('stale-token'), cookies as never);
			throw new Error('Expected CSRF validation to fail.');
		} catch (error) {
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(403);
		}
	});

	it('does not require a token for a non-mutating request', () => {
		const { cookies } = createCookies();
		expect(() =>
			validateCsrfToken(
				new Request('https://www.celebra-me.com/dashboard'),
				cookies as never,
			),
		).not.toThrow();
	});
});

describe('csrf cookie transport security', () => {
	const originalSupabaseUrl = process.env.SUPABASE_URL;

	afterEach(() => {
		if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
		else process.env.SUPABASE_URL = originalSupabaseUrl;
	});

	it('sets a Secure token cookie on a hosted deployment', () => {
		asHostedDeploy('production');
		const { cookies } = createCookies();
		setCsrfToken(cookies as never);
		expect(cookies.set).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ secure: true }),
		);
	});

	it('omits Secure only for a positively local process', () => {
		process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
		const { cookies } = createCookies();
		setCsrfToken(cookies as never);
		expect(cookies.set).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ secure: false }),
		);
	});
});
