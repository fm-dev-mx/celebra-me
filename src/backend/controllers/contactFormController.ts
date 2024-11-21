// src/backend/controllers/contactFormController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';

/**
 * Controller for handling contact form submissions.
 * Now focused solely on business logic without handling HTTP responses.
 */
export class ContactFormController {
	private emailService: EmailService;
	private contactFormRepository: ContactFormRepository;

	constructor(emailService: EmailService, contactFormRepository: ContactFormRepository) {
		this.emailService = emailService;
		this.contactFormRepository = contactFormRepository;
	}

	/**
	 * Processes a contact form submission.
	 * @param validatedData - The validated contact form data.
	 * @throws Will throw an error if processing fails.
	 */
	async processContactFormSubmission(validatedData: ContactFormData): Promise<void> {
		try {
			// Save the data in the database
			await this.contactFormRepository.saveSubmission(validatedData);

			// Prepare the email data
			const emailData: EmailData = {
				to: config.emailConfig.recipient,
				from: config.emailConfig.sender,
				replyTo: validatedData.email,
				subject: `New message from ${validatedData.name} via contact form`,
				html: `<p><strong>Name:</strong> ${validatedData.name}</p>
               <p><strong>Email:</strong> ${validatedData.email}</p>
               <p><strong>Phone:</strong> ${validatedData.mobile}</p>
               <p><strong>Message:</strong> ${validatedData.message}</p>`,
			};

			// Send the email
			await this.emailService.sendEmail(emailData);
		} catch (error) {
			// Log the error and rethrow it for the middleware or route handler to catch
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Error processing contact form submission', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw error; // Rethrow the error for higher-level handling
		}
	}
}
