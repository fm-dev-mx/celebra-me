// src/pages/api/sendEmail.ts

import type { APIRoute, APIContext } from 'astro';
import { sendEmail } from '@/services/emailService';
import { validateInput } from '@/utilities/validateInput';
import { getClientIp } from '@/utilities/getClientIp';
import { createRateLimiter, isRateLimited } from '@/utilities/rateLimiter';
import logger from '@/utilities/logger';
import { validationRules } from '@/utilities/validationRules';
import validator from 'validator';

// Create a rate limiter instance for email sending
const emailRateLimiter = createRateLimiter(5, '15 m', 'emailRateLimiter');

/**
 * Helper function to create a JSON response.
 */
const jsonResponse = (data: Record<string, unknown>, status = 200): Response => {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
};

export const POST: APIRoute = async ({ request }: APIContext) => {
	try {
		const clientIP = getClientIp(request);

		logger.info(`Received request from IP: ${clientIP}`);

		// Check if the client is rate-limited
		const rateLimited = await isRateLimited(emailRateLimiter, clientIP);

		if (rateLimited) {
			logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
			return jsonResponse(
				{
					error: 'Has enviado demasiados mensajes. Por favor, intenta de nuevo más tarde.',
				},
				429
			);
		}

		// Validate the Content-Type header
		const contentType = request.headers.get('Content-Type') || '';
		if (!contentType.includes('application/json')) {
			logger.error(`Invalid Content-Type: ${contentType}`);
			return jsonResponse({ error: 'Invalid Content-Type. Expected application/json' }, 400);
		}

		// Parse the request body
		let parsedData;
		try {
			const requestBody = await request.text();
			parsedData = JSON.parse(requestBody);
		} catch (error) {
			logger.error('Invalid JSON format:', error);
			return jsonResponse({ error: 'Invalid JSON format' }, 400);
		}

		const { name, email, mobile, message } = parsedData;

		// Validate the raw data before sanitization using shared validation rules
		const validationError = validateInput(
			{ name, email, mobile, message },
			validationRules
		);
		if (Object.keys(validationError).length > 0) {
			logger.warn(`Validation errors for IP: ${clientIP}`, validationError);
			return jsonResponse(
				{ error: 'Validation errors', fieldErrors: validationError },
				400
			);
		}

		// Sanitize the form data
		const sanitizedData = {
			name: validator.escape(name),
			email: validator.normalizeEmail(email) || '',
			mobile: validator.escape(mobile),
			message: validator.escape(message),
		};

		// Send the email using SendGrid API
		await sendEmail(sanitizedData);

		logger.info(`Email sent successfully for IP: ${clientIP}`);

		// Return a successful response
		return jsonResponse({
			message: 'Hemos recibido tu mensaje, te responderemos muy pronto.',
		});
	} catch (error: unknown) {
		if (error instanceof Error) {
			logger.error(`Error sending email: ${error.message}`, { stack: error.stack });
		} else {
			logger.error('Unknown error occurred while sending email.');
		}
		return jsonResponse({ error: 'Ha ocurrido un error al enviar el mensaje.' }, 500);
	}
};

export const prerender = false;
