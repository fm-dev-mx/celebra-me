export type ApiErrorCode =
	| 'bad_request'
	| 'unauthorized'
	| 'forbidden'
	| 'not_found'
	| 'rate_limited'
	| 'internal_error';

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
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}
