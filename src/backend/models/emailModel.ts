// src/backend/models/emailModel.ts

import { EmailData } from '@/core/interfaces/emailData.interface';
import { validateInput } from '@/core/utilities/validateInput';
import { validationRules } from '@/core/utilities/validationRules';

/**
 * EmailModel class representing the email data and providing validation functionality.
 */
export class EmailModel {
	/**
	 * Creates an instance of EmailModel.
	 * @param emailData - The email data to initialize the model with.
	 */
	constructor(private emailData: EmailData) { }

	/**
	 * Validates the email data using the defined validation rules.
	 * @returns An object containing validation errors, or an empty object if valid.
	 */
	public validate(): Record<string, string> {
		const errors = validateInput(this.emailData, validationRules);
		return errors;
	}

	/**
	 * Retrieves the email data.
	 * @returns The email data.
	 */
	public getData(): EmailData {
		return this.emailData;
	}
}

/**
 * Example Usage:
 *
 * import { EmailModel } from '@/backend/models/emailModel';
 *
 * const emailData: EmailData = {
 *   name: 'John Doe',
 *   email: 'john.doe@example.com',
 *   mobile: '1234567890',
 *   message: 'Hello, this is a test message.',
 * };
 *
 * const emailModel = new EmailModel(emailData);
 * const validationErrors = emailModel.validate();
 *
 * if (Object.keys(validationErrors).length === 0) {
 *   // Proceed with sending email
 * } else {
 *   // Handle validation errors
 * }
 */
