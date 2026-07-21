import { errorResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';

describe('errorResponse — stack trace / secret exposure regression (CodeQL: Information exposure)', () => {
	it('never leaks error.message for a non-ApiError Error instance containing a stack trace', () => {
		const error = new Error(
			'ReferenceError: X is not defined\n    at Object.<anonymous> (/app/src/something.ts:42:5)',
		);
		const response = errorResponse(error);
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('internal_error');
		expect(body.error.message).toBe('Internal server error.');
		// Must not contain stack trace or internal paths
		expect(body.error.message).not.toContain('ReferenceError');
		expect(body.error.message).not.toContain('/app/src/');
	});

	it('never leaks error.message for an Error instance with a DB URL in its message', () => {
		const error = new Error(
			'Connection refused: postgresql://postgres:secret@db.internal.supabase.co:5432/postgres',
		);
		const response = errorResponse(error);
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.message).toBe('Internal server error.');
		expect(body.error.message).not.toContain('postgresql://');
		expect(body.error.message).not.toContain('supabase.co');
		expect(body.error.message).not.toContain('secret');
	});

	it('never leaks error.message for an Error instance with a SQL query in its message', () => {
		const error = new Error(
			'ERROR: 42P01 relation "secrets.private_keys" does not exist\n  at Parser.parseError',
		);
		const response = errorResponse(error);
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.message).toBe('Internal server error.');
		expect(body.error.message).not.toContain('42P01');
		expect(body.error.message).not.toContain('secrets');
	});

	it('still returns ApiError code and message unchanged', () => {
		const response = errorResponse(new ApiError(404, 'not_found', 'Invitación no encontrada.'));
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('not_found');
		expect(body.error.message).toBe('Invitación no encontrada.');
	});

	it('returns 400 with generic message for plain string errors', () => {
		const response = errorResponse('Something went wrong');
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('internal_error');
		expect(body.error.message).toBe('Internal server error.');
	});

	it('returns 400 with generic message for empty objects', () => {
		const response = errorResponse({});
		const body = JSON.parse(response.body as unknown as string);

		expect(body.success).toBe(false);
		expect(body.error.code).toBe('bad_request');
		expect(body.error.message).toBe('Internal server error.');
	});
});
