// src/pages/api/contact-form-submissions.ts

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
import { clientIpMiddleware } from '@/backend/middlewares/clientIpMiddleware';
import { createSuccessResponse } from '@/core/utilities/apiResponseUtils';
import { jsonResponse } from '@/core/utilities/apiResponseUtils';

/**
 * Initialize services and controllers
 */
const emailProvider = new SendGridProvider();
const emailService = new EmailService(emailProvider);
const contactFormRepository = new ContactFormRepository();
const contactFormController = new ContactFormController(emailService, contactFormRepository);

/**
 * API endpoint to handle contact form submissions.
 * Utilizes middleware for error handling, logging, rate limiting, and validation.
 */
export const POST: APIRoute = errorHandlerMiddleware(
	composeMiddlewares(
		async (context: ContactFormAPIContext): Promise<Response> => {
			// Process the contact form submission using the controller
			await contactFormController.processContactSubmission(context.validatedData!);

			// Return a success response
			const responseBody = createSuccessResponse(200, 'We have received your message and will respond shortly.');
			return jsonResponse(responseBody, 200);
		},
		[
			clientIpMiddleware,
			loggerMiddleware,
			rateLimiterMiddleware({
				limit: 5,
				duration: '15 m',
				prefix: 'emailRateLimiter',
			}),
			validationMiddleware(validationRules),
		]
	)
);

export const prerender = false;
