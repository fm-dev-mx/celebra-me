/**
 * Supabase error mapping utilities
 * Converts Supabase REST API errors to user-friendly ApiError instances
 */

import { ApiError, type ApiErrorCode } from '@/lib/rsvp/core/errors';

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
	guest_invitations_event_country_phone_active_unique: {
		errorCode: 'conflict_duplicate_phone',
		userMessage: 'Ya existe un invitado con ese número de teléfono.',
		httpStatus: 409,
	},
	guest_invitations_phone_country_code_pair_check: {
		errorCode: 'bad_request',
		userMessage: 'Si el teléfono está presente, el código de país también debe estarlo.',
		httpStatus: 400,
	},
};

const PUBLIC_RSVP_RPC_ERROR_MAP: Record<
	string,
	{ httpStatus: number; code: ApiErrorCode; userMessage: string; errorCode: string }
> = {
	invalid_attendance_status: {
		httpStatus: 400,
		code: 'bad_request',
		userMessage: 'El estado de asistencia no es válido.',
		errorCode: 'invalid_attendance_status',
	},
	guest_invitation_not_found: {
		httpStatus: 404,
		code: 'not_found',
		userMessage: 'Invitation not found.',
		errorCode: 'guest_invitation_not_found',
	},
	attendee_count_exceeds_limit: {
		httpStatus: 400,
		code: 'bad_request',
		userMessage: 'El número de asistentes excede el límite de la invitación.',
		errorCode: 'attendee_count_exceeds_limit',
	},
	full_name_required: {
		httpStatus: 400,
		code: 'bad_request',
		userMessage: 'El nombre completo es obligatorio.',
		errorCode: 'full_name_required',
	},
	missing_rsvp_target_identity: {
		httpStatus: 400,
		code: 'bad_request',
		userMessage: 'No se pudo identificar la invitación para el RSVP.',
		errorCode: 'missing_rsvp_target_identity',
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

function matchPublicRsvpRpcError(errorMessage: string) {
	const normalized = errorMessage.trim();
	for (const [token, mapping] of Object.entries(PUBLIC_RSVP_RPC_ERROR_MAP)) {
		if (normalized === token || normalized.includes(token)) {
			return mapping;
		}
	}
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
	if (error instanceof ApiError) {
		return error;
	}
	const supabaseError = parseSupabaseError(error);
	const errorMessage =
		supabaseError?.message || (error instanceof Error ? error.message : String(error));

	const constraintName = extractConstraintName(errorMessage);
	if (constraintName) {
		const mapping = CONSTRAINT_MAP[constraintName];
		if (mapping) {
			return new ApiError(mapping.httpStatus, mapping.httpStatus === 409 ? 'conflict' : 'bad_request', mapping.userMessage, {
				constraint: constraintName,
				errorCode: mapping.errorCode,
			});
		}
	}

	const rpcMapping = matchPublicRsvpRpcError(errorMessage);
	if (rpcMapping) {
		return new ApiError(rpcMapping.httpStatus, rpcMapping.code, rpcMapping.userMessage, {
			errorCode: rpcMapping.errorCode,
		});
	}

	if (errorMessage.includes('23505')) {
		return new ApiError(409, 'conflict', 'Ya existe un registro con los mismos datos.', {
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
