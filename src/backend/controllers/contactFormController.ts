// src/backend/controllers/contactFormController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { createErrorResponse } from '@/core/utilities/apiResponseUtils';

/**
 * Controller for handling contact form submissions.
 * Focused on coordinating between services.
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
	async processContactSubmission(validatedData: ContactFormData): Promise<void> {
		try {
			// Save the data in the database
			await this.contactFormRepository.saveSubmission(validatedData);

			// Prepare the email data
			const emailData = this.prepareEmailData(validatedData);

			// Send the email
			await this.emailService.sendEmail(emailData);

			// Log the successful processing of the contact form at INFO level with context
			logger.info('Contact form submission processed successfully', {
				user: {
					name: validatedData.name,
					email: validatedData.email,
					// Do not log sensitive data like message content or phone number
				},
				event: 'ContactFormSubmission',
			});
		} catch (error) {
			// Log the error with additional context, avoiding sensitive information
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Error processing contact form submission', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				user: {
					name: validatedData.name,
					email: validatedData.email,
					// Do not log sensitive data
				},
				event: 'ContactFormSubmission',
			});
			// Throw an error response with appropriate status code and message
			throw createErrorResponse(500, 'Failed to process contact form submission', undefined, 'PROCESSING_ERROR');
		}
	}

	/**
	 * Prepares the email data from the contact form submission.
	 * @param validatedData - The validated contact form data.
	 * @returns The email data ready to be sent.
	 */
	private prepareEmailData(validatedData: ContactFormData): EmailData {
		return {
			to: config.emailConfig.recipient,
			from: config.emailConfig.sender,
			replyTo: validatedData.email,
			subject: `New message from ${validatedData.name} via contact form`,
			html: this.buildEmailHtml(validatedData),
		};
	}

	/**
	 * Builds the HTML content for the email.
	 * @param validatedData - The validated contact form data.
	 * @returns The HTML string for the email content.
	 */
	private buildEmailHtml(validatedData: ContactFormData): string {
		return `
		  <p><strong>Name:</strong> ${validatedData.name}</p>
		  <p><strong>Email:</strong> ${validatedData.email}</p>
		  <p><strong>Phone:</strong> ${validatedData.mobile}</p>
		  <p><strong>Message:</strong> ${validatedData.message}</p>
		`;
	}
}
