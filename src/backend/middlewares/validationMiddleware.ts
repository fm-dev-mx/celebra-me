// src/backend/middlewares/validationMiddleware.ts

import { Handler } from '@/core/types/api/handlers.type';
import { validateInput } from '@utilities/validateInput';
import { ValidationRules } from '@/core/types/validation/validationRules.type';
import { ContactFormFields } from '@/core/interfaces/forms/contactFormFields.interface';
import { ValidationError } from '@/core/errors/validationError';

const MODULE_NAME = 'validationMiddleware';

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
			const contentType = request.headers.get('Content-Type') || '';
			if (!/^application\/json\b/.test(contentType)) {
				throw new ValidationError(
					'Invalid Content-Type. Expected application/json',
					MODULE_NAME,
				);
			}

			// Parse and sanitize the JSON body
			let data: ContactFormFields;
			try {
				data = await request.json();
			} catch (error: unknown) {
				if (error instanceof SyntaxError) {
					throw new ValidationError('Invalid JSON payload', MODULE_NAME);
				} else {
					throw new ValidationError(
						'An error occurred while parsing the request body',
						MODULE_NAME,
					);
				}
			}

			// Validate the parsed data against the provided rules
			const validationErrorList = validateInput(data, rules);
			if (Object.keys(validationErrorList).length > 0) {
				throw new ValidationError('Validation failed', MODULE_NAME, validationErrorList);
			}

			// Add validated data to the context for downstream handlers
			context.validatedData = data;

			// Proceed to the next handler
			return handler(context);
		};
	};
}
