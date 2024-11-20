// src/pages/api/sendContactForm.ts

import type { APIRoute } from 'astro';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { EmailService } from '@/backend/services/emailService';
import { SendGridProvider } from '@/backend/services/sendGridProvider';
import { loggerMiddleware } from '@/backend/middlewares/loggerMiddleware';
import { rateLimiterMiddleware } from '@/backend/middlewares/rateLimiterMiddleware';
import { validationMiddleware } from '@/backend/middlewares/validationMiddleware';
import { errorHandlerMiddleware } from '@/backend/middlewares/errorHandlerMiddleware';
import { validationRules } from '@/core/utilities/validationRules';
import { composeMiddlewares } from '@/backend/utilities/composeMiddlewares';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { ContactFormController } from '@/backend/controllers/contactFormController';

// Initialize the EmailService and EmailController
const emailProvider = new SendGridProvider();
const emailService = new EmailService(emailProvider);
const contactFormController = new ContactFormController(emailService, new ContactFormRepository());
/**
 * API endpoint to send an email.
 * Utilizes middleware for error handling, logging, rate limiting, and validation.
 */
export const POST: APIRoute = composeMiddlewares(
	async (context: ContactFormAPIContext) => {
		// Delegate the request handling to the EmailController
		return await contactFormController.sendEmail(context);
	},
	[
		// Middlewares are applied in the order they appear in the array
		validationMiddleware(validationRules),
		rateLimiterMiddleware({
			limit: 5,
			duration: '15 m',
			prefix: 'emailRateLimiter',
		}),
		loggerMiddleware,
		errorHandlerMiddleware,
	]
);

export const prerender = false;
