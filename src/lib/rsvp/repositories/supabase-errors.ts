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

export interface ConstraintMapping {
	constraintName: string;
	errorCode: string;
	userMessage: string;
	httpStatus?: number;
}

const CONSTRAINT_MAPPINGS: ConstraintMapping[] = [
	{
		constraintName: 'guest_invitations_event_phone_unique',
		errorCode: 'conflict_duplicate_phone',
		userMessage: 'A guest with that phone number already exists for this event.',
		httpStatus: 409,
	},
];

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
		const mapping = CONSTRAINT_MAPPINGS.find((m) => m.constraintName === constraintName);
		if (mapping) {
			return new ApiError(mapping.httpStatus || 409, 'conflict', mapping.userMessage, {
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

export function isSupabaseConstraintError(error: unknown, constraintName?: string): boolean {
	const supabaseError = parseSupabaseError(error);
	const errorMessage =
		supabaseError?.message || (error instanceof Error ? error.message : String(error));

	const extractedConstraint = extractConstraintName(errorMessage);
	if (!extractedConstraint) return false;

	if (constraintName) {
		return extractedConstraint === constraintName;
	}

	return CONSTRAINT_MAPPINGS.some((m) => m.constraintName === extractedConstraint);
}
