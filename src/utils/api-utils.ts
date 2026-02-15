import { z } from 'zod';

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export interface ApiResponse<T = unknown> {
	data?: T;
	message?: string;
	error?: string;
	code?: string;
	meta?: Record<string, unknown>;
}

/**
 * Creates a standardized success response (200/201)
 */
export function successResponse<T>(
	data: T,
	options: {
		message?: string;
		status?: 200 | 201;
		headers?: HeadersInit;
		meta?: Record<string, unknown>;
	} = {},
): Response {
	const { message, status = 200, headers, meta } = options;
	const body: ApiResponse<T> = { data, meta };
	if (message) body.message = message;

	return new Response(JSON.stringify(body), {
		status,
		headers: { ...JSON_HEADERS, ...headers },
	});
}

/**
 * Creates a standardized error response (4xx/5xx)
 */
export function errorResponse(
	message: string,
	options: {
		status?: number;
		code?: string;
		error?: unknown;
		headers?: HeadersInit;
		meta?: Record<string, unknown>;
	} = {},
): Response {
	const { status = 500, code, error, headers, meta } = options;
	const body: ApiResponse = { error: message, code, meta };

	// Include detailed error info only in development
	if (process.env.NODE_ENV !== 'production' && error) {
		body.meta = {
			...body.meta,
			originalError: error instanceof Error ? error.message : String(error),
		};
	}

	return new Response(JSON.stringify(body), {
		status,
		headers: { ...JSON_HEADERS, ...headers },
	});
}

/**
 * Validates request body against a Zod schema
 */
export async function validateBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
	try {
		const json = await request.json();
		return schema.parse(json);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
			throw new Error(`Validación fallida: ${issues}`);
		}
		throw new Error('Cuerpo de petición inválido o malformado.');
	}
}
