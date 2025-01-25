// src/core/utilities/formValidationHelper.ts

import validator from 'validator';
import { ValidationRule } from '@/core/interfaces/validation/validationRules.interface';

/**
 * Helper to validate form fields.
 */
class FormValidationHelper {
	/**
	 * Validates that a field is not empty.
	 * @param message - The error message to display if validation fails.
	 */
	public static isRequired(message: string): ValidationRule {
		return {
			validator: (value: string) => !validator.isEmpty(value.trim()),
			message,
		};
	}

	/**
	 * Validates that a field's length is within a specified range.
	 * @param min - Minimum number of characters.
	 * @param max - Maximum number of characters.
	 * @param message - The error message to display if validation fails.
	 */
	public static lengthInRange(min: number, max: number, message: string): ValidationRule {
		return {
			validator: (value: string) => validator.isLength(value.trim(), { min, max }),
			message,
		};
	}

	/**
	 * Validates an optional mobile phone field.
	 * Returns true if the field is empty (optional) or contains a valid phone number.
	 * @param message - The error message to display if validation fails.
	 */
	public static isOptionalPhone(message: string): ValidationRule {
		return {
			validator: (value: string) =>
				!value || validator.isMobilePhone(value, ['es-MX', 'en-US']),
			message,
		};
	}

	/**
	 * Validates that a field contains a properly formatted email.
	 * @param message - The error message to display if validation fails.
	 */
	public static isValidEmail(message: string): ValidationRule {
		return {
			validator: (value: string) => validator.isEmail(value.trim()),
			message,
		};
	}
}

export default FormValidationHelper;
