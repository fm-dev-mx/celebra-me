/**
 * Supabase error mapping utilities
 * Converts Supabase REST API errors to user-friendly ApiError instances
 */

import { ApiError } from '@/lib/rsvp/core/errors';

export interface SupabaseErrorResponse {
	message?: string;
	details?: string;
	hint?: string;
	code?: string;
}

const CONSTRAINT_MAP: Record<
	string,
	{ errorCode: string; userMessage: string; httpStatus: number }
> = {
	guest_invitations_event_phone_unique: {
		errorCode: 'conflict_duplicate_phone',
		userMessage: 'A guest with that phone number already exists for this event.',
		httpStatus: 409,
	},
	guest_invitations_phone_country_code_pair_check: {
		errorCode: 'bad_request',
		userMessage: 'Si el teléfono está presente, el código de país también debe estarlo.',
		httpStatus: 400,
	},
};

function extractConstraintName(errorMessage: string): string | null {
	const constraintMatch = errorMessage.match(/constraint "([^"]+)"/);
	if (constraintMatch) return constraintMatch[1];

	const duplicateKeyMatch = errorMessage.match(
		/duplicate key value violates unique constraint "([^"]+)"/,
	);
	if (duplicateKeyMatch) return duplicateKeyMatch[1];

	return null;
}

function parseSupabaseError(error: unknown): SupabaseErrorResponse | null {
	if (typeof error !== 'object' || error === null) return null;

	if (error instanceof Error) {
		try {
			const parsed = JSON.parse(error.message);
			if (typeof parsed === 'object' && parsed !== null) {
				return parsed as SupabaseErrorResponse;
			}
		} catch {
			return {
				message: error.message,
				code: 'unknown',
			};
		}
	}

	return null;
}

export function mapSupabaseErrorToApiError(error: unknown): ApiError {
	const supabaseError = parseSupabaseError(error);
	const errorMessage =
		supabaseError?.message || (error instanceof Error ? error.message : String(error));

	const constraintName = extractConstraintName(errorMessage);
	if (constraintName) {
		const mapping = CONSTRAINT_MAP[constraintName];
		if (mapping) {
			return new ApiError(mapping.httpStatus, 'conflict', mapping.userMessage, {
				constraint: constraintName,
				errorCode: mapping.errorCode,
			});
		}
	}

	if (errorMessage.includes('23505')) {
		return new ApiError(409, 'conflict', 'A record with the same data already exists.', {
			errorCode: 'conflict_unique_violation',
		});
	}

	if (errorMessage.includes('23514')) {
		return new ApiError(
			400,
			'bad_request',
			'Los datos del invitado no cumplen con las reglas de validación.',
			{
				errorCode: 'check_constraint_violation',
			},
		);
	}

	if (errorMessage.includes('PGRST')) {
		return new ApiError(400, 'bad_request', 'Invalid database request.', {
			errorCode: 'postgrest_error',
		});
	}

	return new ApiError(
		500,
		'internal_error',
		'Internal server error while processing the request.',
		{ originalError: errorMessage },
	);
}
