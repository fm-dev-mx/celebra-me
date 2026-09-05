/**
 * Request validation helpers built on top of Zod.
 */

import { z } from 'zod';
import { ApiError, isApiError } from '@/lib/rsvp/core/errors';
import { badRequest, errorResponse, readBoundedRequestText } from '@/lib/rsvp/core/http';

/**
 * Successful validation result.
 */
export interface ValidationResult<T> {
	success: true;
	data: T;
}

export interface ValidationError {
	success: false;
	errors: Array<{
		path: string;
		message: string;
	}>;
	status?: number;
}

export type ValidationOutcome<T> = ValidationResult<T> | ValidationError;

/**
 * Maps a ZodError into the shared validation error shape.
 */
function extractZodErrors(error: z.ZodError): ValidationError['errors'] {
	return error.issues.map((issue) => ({
		path: issue.path.join('.'),
		message: issue.message,
	}));
}

/**
 * Validates a request body against a Zod schema.
 */
export async function validateBody<T>(
	request: Request,
	schema: z.ZodSchema<T>,
	maxBytes = 256 * 1024,
): Promise<ValidationOutcome<T>> {
	let body: unknown;

	try {
		const contentType = request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return {
				success: false,
				errors: [{ path: 'body', message: 'Content-Type must be application/json' }],
			};
		}

		const rawText = await readBoundedRequestText(request, maxBytes);
		if (!rawText.trim()) {
			return {
				success: false,
				errors: [{ path: 'body', message: 'Request body is empty' }],
			};
		}

		body = JSON.parse(rawText);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
		if (isApiError(error)) {
			return {
				success: false,
				errors: [{ path: 'body', message: error.message }],
				status: error.status,
			};
		}
		return {
			success: false,
			errors: [{ path: 'body', message: `Invalid JSON format: ${message}` }],
		};
	}

	const result = schema.safeParse(body);

	if (!result.success) {
		return {
			success: false,
			errors: extractZodErrors(result.error),
		};
	}

	return {
		success: true,
		data: result.data,
	};
}

/**
 * Validates a request body and returns an error Response when validation fails.
 */
export async function validateBodyOrRespond<T>(
	request: Request,
	schema: z.ZodSchema<T>,
	maxBytes = 256 * 1024,
): Promise<T | Response> {
	const result = await validateBody(request, schema, maxBytes);

	if (!result.success) {
		if (result.status) {
			const code = result.status === 413 ? 'payload_too_large' : 'bad_request';
			return errorResponse(
				new ApiError(result.status, code, result.errors[0]?.message ?? 'Invalid request.'),
			);
		}
		const message = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
		return badRequest(message);
	}

	return result.data;
}

/**
 * Validates query params against a Zod schema.
 */
export function validateQuery<T>(
	searchParams: URLSearchParams,
	schema: z.ZodSchema<T>,
): ValidationOutcome<T> {
	const obj: Record<string, string> = {};

	for (const [key, value] of searchParams.entries()) {
		obj[key] = value;
	}

	const result = schema.safeParse(obj);

	if (!result.success) {
		return {
			success: false,
			errors: extractZodErrors(result.error),
		};
	}

	return {
		success: true,
		data: result.data,
	};
}

/**
 * Validates query params and returns a Response when validation fails.
 */
export function validateQueryOrRespond<T>(
	searchParams: URLSearchParams,
	schema: z.ZodSchema<T>,
): T | Response {
	const result = validateQuery(searchParams, schema);

	if (!result.success) {
		const message = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
		return badRequest(message);
	}

	return result.data;
}

