import { safeErr } from '@/lib/server/safe-error';
import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';

const ROW_VALUE = '+52 55 0000 0000';

describe('safeErr', () => {
	it('keeps only the Postgres code for a provider error whose body echoes the row', () => {
		const body = JSON.stringify({
			code: '23505',
			message: 'duplicate key value violates unique constraint "guests_phone_key"',
			details: `Key (phone)=(${ROW_VALUE}) already exists.`,
		});
		const result = safeErr(new SupabaseHttpError(409, body, '23505'));

		expect(result).toEqual({ code: '23505', message: 'SupabaseHttpError (409)' });
		expect(JSON.stringify(result)).not.toContain(ROW_VALUE);
	});

	it('falls back to the HTTP status when the provider gave no code', () => {
		expect(safeErr(new SupabaseHttpError(502, 'bad gateway', null))).toEqual({
			code: 'http_502',
			message: 'SupabaseHttpError (502)',
		});
	});

	it('drops ApiError details and keeps its code and message', () => {
		const error = new ApiError(500, 'internal_error', 'Insert failed.', { phone: ROW_VALUE });
		const result = safeErr(error);

		expect(result).toEqual({ code: 'internal_error', message: 'Insert failed.' });
		expect(JSON.stringify(result)).not.toContain(ROW_VALUE);
	});

	it('drops details and hint from a plain PostgREST error object', () => {
		const result = safeErr({
			code: '23505',
			message: 'duplicate key value violates unique constraint "guests_phone_key"',
			details: `Key (phone)=(${ROW_VALUE}) already exists.`,
			hint: null,
		});

		expect(result).toEqual({
			code: '23505',
			message: 'duplicate key value violates unique constraint "guests_phone_key"',
		});
	});

	it('uses the error name as code for a generic Error and never includes the stack', () => {
		const result = safeErr(new TypeError('x is not a function'));

		expect(result).toEqual({ code: 'TypeError', message: 'x is not a function' });
		expect(Object.keys(result)).toEqual(['code', 'message']);
	});

	it('never echoes a thrown primitive', () => {
		expect(safeErr(ROW_VALUE)).toEqual({
			code: 'unknown',
			message: 'Non-Error value thrown (string)',
		});
	});
});
