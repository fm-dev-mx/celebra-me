import { ApiError } from '@/lib/rsvp/core/errors';
import {
	clearCsrfToken,
	setCsrfToken,
	validateCsrfToken,
} from '@/lib/rsvp/security/csrf';

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
		expect(() => validateCsrfToken(new Request('https://www.celebra-me.com/dashboard'), cookies as never)).not.toThrow();
	});

	it('clears the token on logout/session cleanup', () => {
		const { cookies, getToken } = createCookies('valid-token');
		clearCsrfToken(cookies as never);
		expect(getToken()).toBeUndefined();
	});
});
