import { mapSupabaseErrorToApiError } from '@/lib/rsvp/repositories/supabase-errors';
import { ApiError } from '@/lib/rsvp/core/errors';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';

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
		expect(mapSupabaseErrorToApiError(new Error('attendee_count_exceeds_limit'))).toMatchObject(
			{
				status: 400,
				code: 'bad_request',
			},
		);
		expect(
			mapSupabaseErrorToApiError(
				new Error(JSON.stringify({ code: 'P0001', message: 'invalid_attendance_status' })),
			),
		).toMatchObject({
			status: 400,
			code: 'bad_request',
		});
	});

	it('reads constraint names and RPC tokens from a SupabaseHttpError JSON body', () => {
		const duplicate = new SupabaseHttpError(
			409,
			JSON.stringify({
				code: '23505',
				message:
					'duplicate key value violates unique constraint "guest_invitations_event_country_phone_active_unique"',
			}),
			'23505',
		);
		expect(mapSupabaseErrorToApiError(duplicate)).toMatchObject({
			status: 409,
			code: 'conflict',
			message: 'Ya existe un invitado con ese número de teléfono.',
		});

		const rpcToken = new SupabaseHttpError(
			400,
			JSON.stringify({ code: 'P0001', message: 'guest_invitation_not_found' }),
			'P0001',
		);
		expect(mapSupabaseErrorToApiError(rpcToken)).toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});

	it('maps PostgreSQL 42501 (RLS or grant denial) to a redacted 403 forbidden', () => {
		const body = JSON.stringify({
			code: '42501',
			details: null,
			hint: null,
			message: 'new row violates row-level security policy for table "guest_invitations"',
		});
		const fromHttpError = mapSupabaseErrorToApiError(new SupabaseHttpError(403, body, '42501'));
		const fromJsonMessage = mapSupabaseErrorToApiError(new Error(body));

		for (const mapped of [fromHttpError, fromJsonMessage]) {
			expect(mapped).toMatchObject({
				status: 403,
				code: 'forbidden',
				details: { errorCode: 'insufficient_privilege' },
			});
			expect(mapped.message).not.toContain('row-level security');
			expect(mapped.message).not.toContain('guest_invitations');
		}
	});

	it('maps unknown errors to 500 internal_error', () => {
		const error = new Error('Connection terminated unexpectedly');
		const mapped = mapSupabaseErrorToApiError(error);

		expect(mapped.status).toBe(500);
		expect(mapped.code).toBe('internal_error');
	});
});
