export interface SafeErr {
	code: string;
	message: string;
}

const MAX_MESSAGE_LENGTH = 200;

function readCode(error: object): string | null {
	const code = (error as { code?: unknown }).code;
	if (typeof code === 'string' && code) return code;
	if (typeof code === 'number') return String(code);
	return null;
}

function hasProviderBody(error: Error): boolean {
	return typeof (error as { body?: unknown }).body === 'string';
}

/**
 * Log-safe projection of a thrown value: a code and a short message only. Details, provider
 * bodies, stacks and causes are dropped because they can carry row values (names, phones).
 */
export function safeErr(error: unknown): SafeErr {
	if (error instanceof Error && hasProviderBody(error)) {
		// Provider errors (SupabaseHttpError) embed the response body in the message, and
		// PostgREST bodies echo the offending row in `details`.
		const status = (error as { status?: unknown }).status;
		return {
			code: readCode(error) ?? (typeof status === 'number' ? `http_${status}` : error.name),
			message: typeof status === 'number' ? `${error.name} (${status})` : error.name,
		};
	}
	if (error instanceof Error) {
		return {
			code: readCode(error) ?? error.name,
			message: error.message.slice(0, MAX_MESSAGE_LENGTH),
		};
	}
	if (error && typeof error === 'object') {
		const message = (error as { message?: unknown }).message;
		return {
			code: readCode(error) ?? 'unknown',
			message:
				typeof message === 'string'
					? message.slice(0, MAX_MESSAGE_LENGTH)
					: 'Non-Error object thrown',
		};
	}
	return { code: 'unknown', message: `Non-Error value thrown (${typeof error})` };
}
