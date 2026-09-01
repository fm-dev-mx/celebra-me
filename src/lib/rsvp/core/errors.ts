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
	| 'sign_up'
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
	if (typeof error === 'object' && error !== null) {
		const err = error as Record<string, unknown>;
		return (
			(err.name === 'ApiError' || 'code' in err) &&
			typeof err.status === 'number' &&
			typeof err.code === 'string'
		);
	}
	return false;
}

export function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
