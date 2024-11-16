// src/core/interfaces/emailData.interface.ts

/**
 * Interface representing the structure of email data.
 */
export interface EmailData {
	/**
	 * The name of the sender.
	 * - Required field.
	 * - Must be between 2 and 50 characters.
	 */
	name: string;

	/**
	 * The email address of the sender.
	 * - Required field.
	 * - Must be a valid email format.
	 */
	email: string;

	/**
	 * The mobile phone number of the sender.
	 * - Optional field.
	 * - If provided, must be a valid phone number.
	 */
	mobile?: string;

	/**
	 * The message content.
	 * - Required field.
	 * - Must be between 10 and 500 characters.
	 */
	message: string;
}
