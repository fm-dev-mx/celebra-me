// src/backend/middlewares/validationMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { validateInput } from '@/core/utilities/validateInput';
import { ValidationRules } from '@/core/interfaces/validationRules.interface';
import { jsonResponse } from '@/core/config/constants';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';

/**
 * Validation middleware factory.
 *
 * Creates a middleware that validates incoming request data based on provided validation rules.
 *
 * @param rules - Validation rules to apply to the request data.
 * @returns A middleware function that validates the request and proceeds or responds with errors.
 */
export function validationMiddleware(rules: ValidationRules) {
	return (handler: (context: ContactFormAPIContext) => Promise<Response> | Response): Handler => {
		return async (context) => {
			const { request } = context;

			// Ensure the Content-Type is application/json
			const contentType = request.headers.get('Content-Type') || '';
			if (!contentType.includes('application/json')) {
				return jsonResponse({ success: false, message: 'Invalid Content-Type. Expected application/json' }, 400);
			}

			// Parse and sanitize the request body
			try {
				context.validatedData = await request.json();
			} catch (e) {
				return jsonResponse({ success: false, message: 'Invalid JSON payload' }, 400);
			}

			const validationErrors = context.validatedData ? validateInput(context.validatedData, rules) : {};

			if (Object.keys(validationErrors).length > 0) {
				// Return validation errors as a JSON response
				return jsonResponse({ success: false, errors: validationErrors }, 400);
			}

			// Pass validatedData to handler
			return handler(context);
		};
	};
}
