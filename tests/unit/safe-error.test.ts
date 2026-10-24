import { safeErr } from '@/lib/server/safe-error';
import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';

// Fictional values only.
const PHONE = '+52 55 0000 0000';
const EMAIL = 'guest@example.invalid';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9abcdefghijklmnop';

function expectNoValues(result: unknown): void {
	const text = JSON.stringify(result);
	for (const value of [PHONE, EMAIL, TOKEN, '0000']) expect(text).not.toContain(value);
}

describe('safeErr', () => {
	it('keeps only the Postgres code for a provider error whose body echoes the row', () => {
		const body = JSON.stringify({
			code: '23505',
			message: 'duplicate key value violates unique constraint "guests_phone_key"',
			details: `Key (phone)=(${PHONE}) already exists.`,
		});
		const result = safeErr(new SupabaseHttpError(409, body, '23505'));

		expect(result).toEqual({ code: '23505', message: 'SupabaseHttpError (409)' });
		expectNoValues(result);
	});

	it('falls back to the HTTP status when the provider gave no code', () => {
		expect(safeErr(new SupabaseHttpError(502, 'bad gateway', null))).toEqual({
			code: 'http_502',
			message: 'SupabaseHttpError (502)',
		});
	});

	it('keeps the ApiError code and status but never its message or details', () => {
		const error = new ApiError(500, 'internal_error', 'Insert failed.', { phone: PHONE });
		error.stack =
			'ApiError: Insert failed.\n    at insertGuest (/app/src/lib/rsvp/guest.service.ts:42:9)';

		expect(safeErr(error)).toEqual({
			code: 'internal_error',
			message: 'ApiError (500) at guest.service.ts:42:9',
		});
	});

	it('does not log unquoted names or short credentials from an ApiError message', () => {
		const error = new ApiError(
			500,
			'internal_error',
			`Failed to process guest Fictional Guest with token short-token-123 (${EMAIL}, ${PHONE})`,
		);
		error.stack = undefined;
		const result = safeErr(error);

		expect(result).toEqual({ code: 'internal_error', message: 'ApiError (500)' });
		expect(JSON.stringify(result)).not.toContain('Fictional Guest');
		expect(JSON.stringify(result)).not.toContain('short-token-123');
		expectNoValues(result);
	});

	it('never copies the message of a plain PostgREST error object', () => {
		const result = safeErr({
			code: '22P02',
			message: `invalid input syntax for type uuid: "${EMAIL}"`,
			details: `Key (phone)=(${PHONE}) already exists.`,
			hint: null,
		});

		expect(result).toEqual({ code: '22P02', message: 'Non-Error object thrown' });
		expectNoValues(result);
	});

	it('replaces a runtime error message with its type and code location', () => {
		const error = new Error(
			`Supabase response parse error (200 GET /rest/v1/guests?phone=eq.${PHONE}&email=eq.${EMAIL}): invalid JSON body`,
		);
		error.stack = `Error: ${error.message}\n    at supabaseRestRequest (/app/src/lib/rsvp/repositories/supabase.ts:175:11)`;
		const result = safeErr(error);

		expect(result).toEqual({
			code: 'Error',
			message: 'Unexpected Error at supabase.ts:175:11',
		});
		expectNoValues(result);
	});

	it('does not echo a sensitive code or a message without a stack', () => {
		const error = Object.assign(new TypeError(`token ${TOKEN}`), { code: `bad code ${EMAIL}` });
		error.stack = undefined;

		expect(safeErr(error)).toEqual({ code: 'TypeError', message: 'Unexpected TypeError' });
	});

	it('never echoes a thrown primitive', () => {
		expect(safeErr(PHONE)).toEqual({
			code: 'unknown',
			message: 'Non-Error value thrown (string)',
		});
	});
});
