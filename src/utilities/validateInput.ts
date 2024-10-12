// src/utilities/validateInput.ts

/**
 * Interface for individual validation rules.
 */
interface ValidationRule {
	validator: (value: string) => boolean;
	message: string;
}

/**
 * Type for the collection of validation rules.
 */
export type ValidationRules = Record<string, ValidationRule[]>;

/**
 * Validates input data based on provided rules.
 */
export function validateInput(
	data: Record<string, string>,
	rules: ValidationRules
): Record<string, string> {
	const errors: Record<string, string> = {};

	for (const fieldName in rules) {
		const fieldRules = rules[fieldName];
		const fieldValue = data[fieldName];

		for (const rule of fieldRules) {
			if (!rule.validator(fieldValue)) {
				errors[fieldName] = rule.message;
				break; // Stop at the first validation error for this field
			}
		}
	}

	return errors;
}
