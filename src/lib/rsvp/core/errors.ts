export type ApiErrorCode =
	| 'bad_request'
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
