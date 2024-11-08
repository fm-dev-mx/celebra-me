// src/core/utilities/validateInput.ts

import { ValidationRules } from '@/core/interfaces/validationRules.interface';

/**
 * Validates input data based on provided rules.
 *
 * @param data - An object where keys are field names and values are the field values.
 * @param rules - Validation rules for each field.
 * @returns An object containing error messages for fields that failed validation.
 *
 * **Example Usage:**
 * ```typescript
 * const data = { name: 'John', email: 'invalid-email' };
 * const errors = validateInput(data, validationRules);
 * // errors = { email: 'Ingresa un correo electrónico válido.' }
 * ```
 *
 * **Adding New Validation Rules:**
 * - Update `validationRules` in `rules.ts` with new field validations.
 */
export function validateInput(
	data: Partial<Record<string, string>>,
	rules: ValidationRules
): Record<string, string> {
	const errors: Record<string, string> = {};

	for (const fieldName in rules) {
		const fieldRules = rules[fieldName];
		const fieldValue = data[fieldName];

		for (const rule of fieldRules) {
			if (!rule.validator(fieldValue ?? '')) {
				errors[fieldName] = rule.message;
				break; // Stop at the first validation error for this field
			}
		}
	}

	return errors;
}
