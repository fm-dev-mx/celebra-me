// src/core/utilities/validateInput.ts

import { ValidationRules } from '@interfaces/shared/validationRules.interface';
import { ContactFormData } from '../interfaces/forms/contactFormData.interface';
import { EmailData } from '../interfaces/email/emailData.interface';

type admittedInputType =
	| ContactFormData
	| Partial<ContactFormData>
	| EmailData
	| Partial<EmailData>;
/**
 * Validates input data against the provided validation rules.
 * @param data - The data to validate.
 * @param rules - The validation rules to apply.
 * @returns An object containing validation errors, if any.
 */
export const validateInput = (
	data: admittedInputType,
	rules: ValidationRules,
): Record<string, string> => {
	const errors: Record<string, string> = {};

	for (const fieldName in rules) {
		const fieldRules = rules[fieldName];
		const value = data[fieldName as keyof admittedInputType] || '';

		for (const rule of fieldRules) {
			if (!rule.validator(value)) {
				errors[fieldName] = rule.message;
				break; // Stop at the first validation error for the field
			}
		}
	}

	return errors;
};
