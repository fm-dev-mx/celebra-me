// src/backend/middlewares/validationMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { validateInput } from '@/core/utilities/validateInput';
import { ValidationRules } from '@/core/interfaces/validationRules.interface';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { ApiErrorResponse } from '@/core/interfaces/apiResponse.interface';

/**
 * Validation middleware factory.
 *
 * Creates a middleware that validates incoming request data based on provided validation rules.
 *
 * @param rules - Validation rules to apply to the request data.
 * @returns A middleware function that validates the request and proceeds or responds with errors.
 */
export function validationMiddleware(rules: ValidationRules) {
	return (handler: Handler): Handler => {
		return async (context) => {
			const { request } = context;

			// Ensure the Content-Type is application/json
			const contentType = request.headers.get('Content-Type') || '';
			if (!contentType.includes('application/json')) {
				throw {
					success: false,
					statusCode: 400,
					message: 'Invalid Content-Type. Expected application/json',
				} as ApiErrorResponse;
			}

			// Parse and sanitize the request body
			let data: ContactFormData;
			try {
				data = await request.json();
			} catch (e) {
				throw {
					success: false,
					statusCode: 400,
					message: 'Invalid JSON payload',
				} as ApiErrorResponse;
			}

			const validationErrors = validateInput(data, rules);

			if (Object.keys(validationErrors).length > 0) {
				// Throw validation errors
				throw {
					success: false,
					statusCode: 400,
					message: 'Validation failed',
					errors: validationErrors,
				} as ApiErrorResponse;
			}

			// Pass validatedData to handler
			context.validatedData = data;
			return handler(context);
		};
	};
}
