// src/pages/api/sendEmail.ts

import type { APIRoute, APIContext } from 'astro';
import { sendEmail } from '@/backend/services/emailService';
import { validateInput } from '@/utilities/validateInput';
import { getClientIp } from '@/utilities/getClientIp';
import { getRateLimiter, isRateLimited } from '@/utilities/rateLimiter';
import logger from '@/utilities/logger';
import { validationRules } from '@/utilities/validationRules';
import validator from 'validator';
const { trim, normalizeEmail } = validator;
import supabase from '@/utilities/supabaseClient';

const emailRateLimiter = getRateLimiter(5, '15 m', 'emailRateLimiter');

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
	let clientIP: string | null = null;
	try {
		clientIP = getClientIp(request);
		logger.info(`Received request from IP: ${clientIP}`);

		// Set the rate limit key based on the environment
		const rateLimitKey = process.env.NODE_ENV === 'production' ? clientIP : 'development-key';

		if (!rateLimitKey) {
			logger.warn('Rate limiting failed: key is undefined or empty.');
			return jsonResponse({ error: 'Internal Server Error' }, 500);
		}

		const rateLimited = await isRateLimited(emailRateLimiter, rateLimitKey);
		if (rateLimited) {
			logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
			return jsonResponse(
				{
					error: 'Has enviado demasiados mensajes. Por favor, intenta de nuevo más tarde.',
				},
				429
			);
		}

		// Validate that the Content-Type is application/json
		const contentType = request.headers.get('Content-Type') || '';
		if (!contentType.includes('application/json')) {
			logger.error(`Invalid Content-Type: ${contentType}`);
			return jsonResponse({ error: 'Invalid Content-Type. Expected application/json' }, 400);
		}

		// Analyze the request body
		const parsedData = await request.json();
		const { name, email, mobile, message } = parsedData;

		// Validate the data before sanitization using shared validation rules
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

		// Sanitize the data before sending
		const sanitizedData = {
			name: trim(name),
			email: normalizeEmail(email) || '',
			mobile: trim(mobile),
			message: trim(message),
		};

		// Send the email using SendGrid
		await sendEmail(sanitizedData);
		logger.info(`Email sent successfully for IP: ${clientIP}`);

		// Store the submission details in Supabase
		const { error: insertError } = await supabase
			.from('contact_submissions')
			.insert([
				{
					name: sanitizedData.name,
					email: sanitizedData.email,
					mobile: sanitizedData.mobile,
					message: sanitizedData.message,
					ip_address: clientIP,
					created_at: new Date().toISOString(),
				},
			]);

		if (insertError) {
			logger.error(`Error storing submission data for IP: ${clientIP}`, { error: insertError.message });
			return jsonResponse({ error: 'Failed to store submission data.' }, 500);
		} else {
			logger.info(`Submission data stored successfully for IP: ${clientIP}`);
		}

		// return a success response
		return jsonResponse({
			message: 'Hemos recibido tu mensaje, te responderemos muy pronto.',
		});
	} catch (error: unknown) {
		let errorMessage = 'Unknown error';
		if (error instanceof Error) {
			errorMessage = error.message;
			logger.error(`Error processing request for IP: ${clientIP}`, {
				error: errorMessage,
				stack: error.stack,
			});
		} else {
			logger.error(`Error processing request for IP: ${clientIP}`, { error });
		}
		return jsonResponse({ error: 'Ha ocurrido un error al enviar el mensaje.' }, 500);
	}
};

export const prerender = false;
