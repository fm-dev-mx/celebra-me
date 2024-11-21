// src/backend/middlewares/validationMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { validateInput } from '@/core/utilities/validateInput';
import { ValidationRules } from '@/core/interfaces/validationRules.interface';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { createErrorResponse } from '@/core/utilities/apiResponseUtils';

/**
 * Validation middleware factory.
 *
 * Creates a middleware that validates incoming request data based on provided validation rules.
 * If validation passes, the sanitized and validated data is added to the context.
 *
 * @param rules - Validation rules to apply to the request data.
 * @returns A middleware function that validates the request or throws errors.
 */
export function validationMiddleware(rules: ValidationRules) {
	return (handler: Handler): Handler => {
		return async (context): Promise<Response> => {
			const { request } = context;

			// Check if the request Content-Type is application/json
			if (!request.headers.get('Content-Type')?.includes('application/json')) {
				throw createErrorResponse(400, 'Invalid Content-Type. Expected application/json');
			}

			// Parse and sanitize the JSON body
			let data: ContactFormData;
			try {
				data = await request.json();
			} catch {
				throw createErrorResponse(400, 'Invalid JSON payload');
			}

			// Validate the parsed data against the provided rules
			const validationErrors = validateInput(data, rules);
			if (Object.keys(validationErrors).length > 0) {
				throw createErrorResponse(400, 'Validation failed', validationErrors, 'VALIDATION_ERROR');
			}

			// Add validated data to the context for downstream handlers
			context.validatedData = data;

			// Proceed to the next handler
			return handler(context);
		};
	};
}
