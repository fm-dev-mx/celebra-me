export type ApiErrorCode =
	| 'bad_request'
	| 'payload_too_large'
	| 'unauthorized'
	| 'validation_error'
	| 'forbidden'
	| 'not_found'
	| 'conflict'
	| 'rate_limited'
	| 'limit_reached'
	| 'internal_error'
	| 'service_unavailable'
	| 'upstream_error'
	| 'submission_already_approved'
	| 'invalid_submission_status'
	| 'invalid_draft_status'
	| 'config_error'
	| 'no_approved_submission'
	| 'schema_mismatch'
	| 'unsafe_target'
	| 'missing_in_prod'
	| 'stale_production_content'
	| 'upgrade_required'
	| 'account_access_incomplete'
	| 'password_change_required'
	| 'password_update_failed'
	| 'metadata_update_failed';

export class ApiError extends Error {
	readonly status: number;
	readonly code: ApiErrorCode;
	readonly details?: Record<string, unknown>;

	constructor(
		status: number,
		code: ApiErrorCode,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export type AuthRequestErrorKind = 'timeout' | 'network' | 'http' | 'invalid_response';

export type AuthOperation =
	| 'validate_access_token'
	| 'password_sign_in'
	| 'refresh_session'
	| 'send_magic_link'
	| 'list_users'
	| 'create_user_admin'
	| 'get_user_admin'
	| 'update_user_admin'
	| 'update_password';

export class AuthRequestError extends Error {
	readonly kind: AuthRequestErrorKind;
	readonly operation: AuthOperation;
	readonly status?: number;
	readonly retryable: boolean;

	constructor(input: { kind: AuthRequestErrorKind; operation: AuthOperation; status?: number }) {
		super('Auth request failed.');
		this.name = 'AuthRequestError';
		this.kind = input.kind;
		this.operation = input.operation;
		this.status = input.status;
		this.retryable =
			input.kind === 'timeout' ||
			input.kind === 'network' ||
			input.kind === 'invalid_response' ||
			(input.kind === 'http' &&
				(input.status === 429 ||
					(typeof input.status === 'number' && input.status >= 500)));
	}
}

export function isAuthRequestError(error: unknown): error is AuthRequestError {
	return error instanceof AuthRequestError;
}

export function isRejectedAuthCredential(error: unknown): error is AuthRequestError {
	return (
		isAuthRequestError(error) &&
		error.kind === 'http' &&
		(error.status === 400 || error.status === 401 || error.status === 403)
	);
}

export function isApiError(error: unknown): error is ApiError {
	if (error instanceof ApiError) return true;
	// Match only by name (e.g. an ApiError from another module instance). Provider
	// errors such as SupabaseHttpError also carry numeric `status` and string
	// `code`; treating them as ApiErrors would skip mapping and send raw database
	// messages to clients.
	if (typeof error === 'object' && error !== null) {
		const err = error as Record<string, unknown>;
		return (
			err.name === 'ApiError' &&
			typeof err.status === 'number' &&
			typeof err.code === 'string'
		);
	}
	return false;
}

/**
 * Postgres/PostgREST codes raised when the application reads a table, column, or
 * function the database does not have yet: pending migrations, not a request bug.
 * Codes that a malformed request can also raise (e.g. `42883`, `PGRST204`) stay out.
 */
const SCHEMA_DRIFT_CODES = new Set(['42703', '42P01', 'PGRST202', 'PGRST205']);

/** Matches `SupabaseHttpError` by name so core does not depend on the repository layer. */
export function isSchemaDriftError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const err = error as Record<string, unknown>;
	return (
		err.name === 'SupabaseHttpError' &&
		typeof err.code === 'string' &&
		SCHEMA_DRIFT_CODES.has(err.code)
	);
}

export function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
