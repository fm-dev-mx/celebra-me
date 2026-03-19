/**
 * Utilidades de validación de requests
 * Proporciona funciones helper para validar datos de entrada con Zod
 */

import { z } from 'zod';
import { badRequest } from '@/lib/rsvp/core/http';

/**
 * Resultados de validación
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
 * Extrae los mensajes de error de una excepción de Zod
 */
function extractZodErrors(error: z.ZodError): ValidationError['errors'] {
	return error.issues.map((issue) => ({
		path: issue.path.join('.'),
		message: issue.message,
	}));
}

/**
 * Valida el body de una request contra un schema de Zod
 * @returns Data validada o error de validación
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
 * Valida el body de una request y retorna Response de error si falla
 * Útil para usar directamente en handlers de API
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
 * Valida query params contra un schema de Zod
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
 * Valida query params y retorna Response si falla
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
 * Valida un objeto contra un schema de Zod
 * Útil para validar datos ya parseados
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
 * Valida y retorna error si falla
 */
export function validateOrThrow<T>(
	data: unknown,
	schema: z.ZodSchema<T>,
	errorMessage = 'Error de validación',
): T {
	const result = validate(data, schema);

	if (!result.success) {
		const message = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
		throw new Error(`${errorMessage}: ${message}`);
	}

	return result.data;
}

/**
 * Convierte errores de Zod a formato de API
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
