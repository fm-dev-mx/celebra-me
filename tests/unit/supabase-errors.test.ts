import { mapSupabaseErrorToApiError } from '@/lib/rsvp/repositories/supabase-errors';
import { ApiError } from '@/lib/rsvp/core/errors';

describe('supabase errors mapping', () => {
	it('preserves existing ApiError instances without rewrapping', () => {
		const original = new ApiError(400, 'bad_request', 'Invalid payload');
		const mapped = mapSupabaseErrorToApiError(original);

		expect(mapped).toBe(original);
	});

	it('maps constraint guest_invitations_event_country_phone_active_unique to 409 conflict', () => {
		const error = new Error(
			'violates unique constraint "guest_invitations_event_country_phone_active_unique"',
		);
		const mapped = mapSupabaseErrorToApiError(error);

		expect(mapped.status).toBe(409);
		expect(mapped.code).toBe('conflict');
		expect(mapped.message).toBe('Ya existe un invitado con ese número de teléfono.');
	});

	it('maps public RSVP RPC P0001 messages to client-facing ApiErrors', () => {
		expect(mapSupabaseErrorToApiError(new Error('guest_invitation_not_found'))).toMatchObject({
			status: 404,
			code: 'not_found',
		});
		expect(mapSupabaseErrorToApiError(new Error('attendee_count_exceeds_limit'))).toMatchObject({
			status: 400,
			code: 'bad_request',
		});
		expect(
			mapSupabaseErrorToApiError(
				new Error(JSON.stringify({ code: 'P0001', message: 'invalid_attendance_status' })),
			),
		).toMatchObject({
			status: 400,
			code: 'bad_request',
		});
	});

	it('maps unknown errors to 500 internal_error', () => {
		const error = new Error('Connection terminated unexpectedly');
		const mapped = mapSupabaseErrorToApiError(error);

		expect(mapped.status).toBe(500);
		expect(mapped.code).toBe('internal_error');
	});
});
