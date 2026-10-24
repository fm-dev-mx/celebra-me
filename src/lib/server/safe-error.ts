import { isApiError } from '@/lib/rsvp/core/errors';

export interface SafeErr {
	code: string;
	message: string;
}

const MAX_MESSAGE_LENGTH = 200;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

// Applied in order; each pattern can carry guest or credential values.
const REDACTIONS: readonly [RegExp, string][] = [
	[/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>'],
	[/\S*[?=&]\S*/g, '<redacted>'],
	[/"[^"]*"|'[^']*'|`[^`]*`/g, '"<redacted>"'],
	[/[^\s@"'<>]+@[^\s@"'<>]+/g, '<email>'],
	[/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>'],
	[/\b[A-Za-z0-9_-]{24,}\b/g, '<token>'],
	[/\+?\d[\d\s().-]{5,}\d/g, '<number>'],
];

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

/** Defensive pass over app-authored text: strips values a message may have interpolated. */
export function redactLogText(text: string): string {
	let result = text;
	for (const [pattern, replacement] of REDACTIONS) result = result.replace(pattern, replacement);
	return result.slice(0, MAX_MESSAGE_LENGTH);
}

/** `file:line:col` of the first stack frame, which points at code, never at data. */
function firstFrame(error: Error): string | null {
	const frame = error.stack?.split('\n').find((line) => line.trim().startsWith('at '));
	const location = frame?.match(/([^\s()/\\]+:\d+:\d+)\)?\s*$/);
	return location ? location[1] : null;
}

/**
 * Log-safe projection of a thrown value: a stable code and a known-safe message only.
 * Only `ApiError` messages are app-authored, so they are kept (redacted); provider and
 * runtime messages can embed rows, filters or tokens and are replaced by a generic text.
 */
export function safeErr(error: unknown): SafeErr {
	if (isApiError(error)) {
		return { code: error.code, message: redactLogText(error.message) };
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
