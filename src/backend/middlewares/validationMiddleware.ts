// src/backend/middlewares/validationMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { validateInput } from '@/core/utilities/validateInput';
import { ValidationRules } from '@/core/interfaces/validationRules.interface';
import { jsonResponse } from '@/core/config/constants';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';

/**
 * Validation middleware factory.
 *
 * Creates a middleware that validates incoming request data based on provided validation rules.
 *
 * @param rules - Validation rules to apply to the request data.
 * @returns A middleware function that validates the request and proceeds or responds with errors.
 *
 * @example
 * export const POST: Handler = validationMiddleware(validationRules)(async (context) => {
 *   // Handler code
 * });
 */
export function validationMiddleware(rules: ValidationRules) {
	return (handler: Handler): Handler => {
		return async (context: ContactFormAPIContext) => {
			const { request } = context;

			// Ensure the Content-Type is application/json
			const contentType = request.headers.get('Content-Type') || '';
			if (!contentType.includes('application/json')) {
				return jsonResponse({ success: false, message: 'Invalid Content-Type. Expected application/json' }, 400);
			}

			// Parse and sanitize the request body
			let data: Partial<EmailData>;
			try {
				data = await request.json();
			} catch (e) {
				return jsonResponse({ success: false, message: 'Invalid JSON payload' }, 400);
			}

			// Perform validation
			const validationErrors = validateInput(data, rules);

			if (Object.keys(validationErrors).length > 0) {
				// Return validation errors to the client
				return jsonResponse({ success: false, errors: validationErrors }, 400);
			}

			// Assign validated data directly to context
			context.validatedData = data;

			return handler(context);
		};
	};
}
