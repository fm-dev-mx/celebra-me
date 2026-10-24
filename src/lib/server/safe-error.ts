import { isApiError } from '@/lib/rsvp/core/errors';

export interface SafeErr {
	code: string;
	message: string;
}

const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

function readCode(error: object): string | null {
	const code = (error as { code?: unknown }).code;
	const text = typeof code === 'number' ? String(code) : code;
	return typeof text === 'string' && SAFE_CODE.test(text) ? text : null;
}

function safeName(error: Error): string {
	return SAFE_CODE.test(error.name) ? error.name : 'Error';
}

function hasProviderBody(error: Error): boolean {
	return typeof (error as { body?: unknown }).body === 'string';
}

/** `file:line:col` of the first stack frame, which points at code, never at data. */
function firstFrame(error: Error): string | null {
	const frame = error.stack?.split('\n').find((line) => line.trim().startsWith('at '));
	const location = frame?.match(/([^\s()/\\]+:\d+:\d+)\)?\s*$/);
	return location ? location[1] : null;
}

/**
 * Log-safe projection of a thrown value: a stable code and a generic message only. No thrown
 * message is copied, ApiError included, because messages can interpolate names, phones or
 * tokens; the code, status and first stack frame are enough to find the failing call.
 */
export function safeErr(error: unknown): SafeErr {
	if (isApiError(error)) {
		const frame = firstFrame(error);
		return {
			code: error.code,
			message: frame
				? `ApiError (${error.status}) at ${frame}`
				: `ApiError (${error.status})`,
		};
	}
	if (error instanceof Error) {
		const name = safeName(error);
		const status = (error as { status?: unknown }).status;
		if (hasProviderBody(error)) {
			// Provider errors (SupabaseHttpError) embed the response body in the message.
			return {
				code: readCode(error) ?? (typeof status === 'number' ? `http_${status}` : name),
				message: typeof status === 'number' ? `${name} (${status})` : name,
			};
		}
		const frame = firstFrame(error);
		return {
			code: readCode(error) ?? name,
			message: frame ? `Unexpected ${name} at ${frame}` : `Unexpected ${name}`,
		};
	}
	if (error && typeof error === 'object') {
		return { code: readCode(error) ?? 'unknown', message: 'Non-Error object thrown' };
	}
	return { code: 'unknown', message: `Non-Error value thrown (${typeof error})` };
}
