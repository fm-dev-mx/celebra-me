// src/core/utilities/validateInput.ts

import { ValidationRules } from '@/core/interfaces/validationRules.interface';

/**
 * Validates input data against the provided validation rules.
 * @param data - The data to validate.
 * @param rules - The validation rules to apply.
 * @returns An object containing validation errors, if any.
 */
export const validateInput = (
	data: Partial<Record<string, string>>,
	rules: ValidationRules,
): Record<string, string> => {
	const errors: Record<string, string> = {};

	for (const fieldName in rules) {
		const fieldRules = rules[fieldName];
		const value = data[fieldName] || '';

		for (const rule of fieldRules) {
			if (!rule.validator(value)) {
				errors[fieldName] = rule.message;
				break; // Stop at the first validation error for the field
			}
		}
	}

	return errors;
};
