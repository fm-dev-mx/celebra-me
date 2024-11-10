// src/pages/api/sendEmail.ts

import type { APIRoute, APIContext } from 'astro';
import { EmailService } from '@/backend/services/emailService';
import { SendGridProvider } from '@/backend/services/sendGridProvider';
import { getClientIp } from '@/backend/utilities/getClientIp';
import { rateLimiterManager, isRateLimited } from '@/backend/utilities/rateLimiterUtils';
import validator from 'validator';
import SupabaseClientManager from '@/infrastructure/supabaseClient';
import { jsonResponse } from '@/core/config/constants';

const { trim, normalizeEmail } = validator;
const logger = await import('@/backend/utilities/logger').then((module) => module.default);

/**
 * Initialize the rate limiter with the desired configuration.
 *
 * This ensures that the rate limiter is set up once and reused across requests.
 */
const initializeRateLimiter = async () => {
	return await rateLimiterManager.getRateLimiter({
		limit: 5,         // Maximum number of requests
		duration: '15 m', // Time window for the rate limit
		prefix: 'emailRateLimiter',
	});
};

/**
 * Helper function to create a JSON response.
 *
 * @param data - The data to include in the JSON response.
 * @param status - The HTTP status code for the response.
 * @returns {Response} - The constructed JSON response.
 */


/**
 * Handler for POST requests to send an email.
 *
 * @param {APIContext} context - The API context containing the request object.
 * @returns {Promise<Response>} - The response after processing the request.
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
	let clientIP: string | null = null;

	try {
		// Retrieve the client's IP address from the request
		clientIP = getClientIp(request);
		logger.info(`Received request from IP: ${clientIP || 'Unknown'}`);

		// Determine the rate limit key based on the environment and availability of clientIP
		let rateLimitKey: string;

		if (process.env.NODE_ENV === 'production') {
			if (clientIP) {
				rateLimitKey = clientIP;
			} else {
				// Fallback: Generate a unique key based on headers to avoid a shared key
				const userAgent = request.headers.get('user-agent') || 'unknown';
				const acceptLanguage = request.headers.get('accept-language') || 'unknown';
				rateLimitKey = `no-ip-${userAgent}-${acceptLanguage}`;
				logger.warn('Client IP not detected in production; using fallback rate limit key.');
			}
		} else {
			// In development, use a static key to simplify testing without rate limiting per IP
			rateLimitKey = 'development-key';
		}

		// Apply rate limiting
		const emailRateLimiter = await initializeRateLimiter();
		const rateLimited = await isRateLimited(emailRateLimiter, rateLimitKey);

		if (rateLimited) {
			logger.warn(`Rate limit exceeded for key: ${rateLimitKey}`);
			return jsonResponse(
				{
					error: 'You have sent too many messages. Please try again later.',
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

		// Parse and sanitize the request body
		const parsedData = await request.json();
		const { name, email, mobile, message } = parsedData;

		const sanitizedData = {
			name: trim(name),
			email: normalizeEmail(email) || '',
			mobile: trim(mobile || ''),
			message: trim(message),
		};

		// Initialize the EmailService with SendGridProvider
		const emailProvider = new SendGridProvider();
		const emailService = new EmailService(emailProvider);

		// Send the email using EmailService
		await emailService.sendEmail(sanitizedData);
		logger.info(`Email sent successfully for IP: ${clientIP || 'Unknown'}`);

		// Store the submission details in Supabase
		const supabase = await SupabaseClientManager.getInstance();
		const { error: insertError } = await supabase
			.from('contact_submissions')
			.insert([
				{
					name: sanitizedData.name,
					email: sanitizedData.email,
					mobile: sanitizedData.mobile,
					message: sanitizedData.message,
					ip_address: clientIP || 'Unknown',
					created_at: new Date().toISOString(),
				},
			]);

		if (insertError) {
			logger.error(`Error storing submission data for IP: ${clientIP || 'Unknown'}`, { error: insertError.message });
			return jsonResponse({ error: 'Failed to store submission data.' }, 500);
		} else {
			logger.info(`Submission data stored successfully for IP: ${clientIP || 'Unknown'}`);
		}

		// Return a success response
		return jsonResponse({
			message: 'We have received your message and will respond shortly.',
		});
	} catch (error: unknown) {
		let errorMessage = 'Unknown error';
		if (error instanceof Error) {
			errorMessage = error.message;
			logger.error(`Error processing request for IP: ${clientIP || 'Unknown'}`, {
				error: errorMessage,
				stack: error.stack,
			});
		} else {
			logger.error(`Error processing request for IP: ${clientIP || 'Unknown'}`, { error });
		}
		return jsonResponse({ error: 'An error occurred while sending your message.' }, 500);
	}
};

/**
 * Disable prerendering for this API route.
 */
export const prerender = false;
