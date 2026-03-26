/**
 * Request validation helpers built on top of Zod.
 */

import { z } from 'zod';
import { badRequest } from '@/lib/rsvp/core/http';

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

		const rawText = await request.text();
		if (!rawText.trim()) {
			return {
				success: false,
				errors: [{ path: 'body', message: 'Request body is empty' }],
			};
		}

		body = JSON.parse(rawText);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON';
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
): Promise<T | Response> {
	const result = await validateBody(request, schema);

	if (!result.success) {
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

/**
 * Validates an already parsed value against a Zod schema.
 */
export function validate<T>(data: unknown, schema: z.ZodSchema<T>): ValidationOutcome<T> {
	const result = schema.safeParse(data);

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
 * Validates data and throws when validation fails.
 */
export function validateOrThrow<T>(
	data: unknown,
	schema: z.ZodSchema<T>,
	errorMessage = 'Validation error',
): T {
	const result = validate(data, schema);

	if (!result.success) {
		const message = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
		throw new Error(`${errorMessage}: ${message}`);
	}

	return result.data;
}

/**
 * Converts Zod validation errors into the shared API error payload.
 */
export function formatZodErrors(error: z.ZodError): Record<string, unknown> {
	return {
		validation: error.issues.map((issue) => ({
			field: issue.path.join('.'),
			message: issue.message,
			code: issue.code,
		})),
	};
}
