// src/pages/api/contact-form-submissions.ts

import type { APIRoute } from 'astro';
import { ContactFormAPIContext } from '@/core/interfaces/api/contactFormAPIContext.interface';
import { EmailService } from '@/backend/services/emailService';
import { SendGridProvider } from '@/backend/services/sendGridProvider';
import { loggerMiddleware } from '@/backend/middlewares/loggerMiddleware';
import { rateLimiterMiddleware } from '@/backend/middlewares/rateLimiterMiddleware';
import { validationMiddleware } from '@/backend/middlewares/validationMiddleware';
import { errorHandlerMiddleware } from '@/backend/middlewares/errorHandlerMiddleware';
import { contactFormValidationRules } from '@/core/utilities/contactFormValidationRules';
import { composeMiddlewares } from '@/backend/utilities/composeMiddlewares';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { ContactFormController } from '@/backend/controllers/contactFormController';
import { clientIpMiddleware } from '@/backend/middlewares/clientIpMiddleware';
import { createSuccessResponse, jsonResponse } from '@utilities/apiResponseUtils';
import config from '@/core/config';

// Initialize email-related instances once (outside the handler)
const { sendgridApiKey } = config.contactFormEmailConfig;
const emailProvider = new SendGridProvider(sendgridApiKey);
const emailService = new EmailService(emailProvider);
const contactFormRepository = new ContactFormRepository();
const contactFormController = new ContactFormController(emailService, contactFormRepository);

/**
 * API endpoint to handle contact form submissions.
 */
export const POST: APIRoute = errorHandlerMiddleware(
	composeMiddlewares(
		async (context: ContactFormAPIContext): Promise<Response> => {
			// Process the contact form submission using the controller
			await contactFormController.processContactSubmission(context.validatedData!);

			// Return a success response
			const responseBody = createSuccessResponse(
				200,
				'Hemos recibido tu mensaje. Te responderemos muy pronto.',
			);
			return jsonResponse(responseBody, 200);
		},
		[
			clientIpMiddleware,
			loggerMiddleware,
                        rateLimiterMiddleware({
                                limit: 5,
                                duration: '15m',
                                prefix: 'emailRateLimiter',
                        }),
			validationMiddleware(contactFormValidationRules),
		],
	),
);

export const prerender = false;
