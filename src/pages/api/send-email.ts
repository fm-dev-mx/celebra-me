// src/pages/api/send-email.ts
import type { APIRoute, APIContext } from 'astro';
import { createRateLimiter, isRateLimited } from '@/utilities/rate-limiter';
import { sendEmail } from '@/services/email-service';
import { validateInput } from '@/utilities/validate-input';
import { getClientIP } from '@/utilities/get-client-ip';
import validator from 'validator';

const jsonResponse = (data: object, status = 200) => {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
};

// Create a rate limiter specifically for email sending
const emailRateLimiter = createRateLimiter({
	points: 5, // Maximum number of email requests
	duration: 15 * 60, // Per 15 minutes
	keyPrefix: 'emailRateLimiter',
});

export const POST: APIRoute = async ({ request }: APIContext) => {
	try {
		const clientIP = getClientIP(request);
		const { isRateLimited: rateLimited, remainingPoints } = await isRateLimited(
			clientIP,
			emailRateLimiter
		);

		// Calculate the number of attempts already made (based on total points - remaining points)
		const totalAttempts = emailRateLimiter.points - remainingPoints;
		console.log(`Total attempts: ${totalAttempts}`);

		if (rateLimited) {
			console.warn(`Rate limit exceeded for IP: ${clientIP}`);
			return jsonResponse(
				{
					error: 'Too many requests, please try again later.',
					remainingPoints,  // Remaining points to show how many attempts are left
					totalAttempts,     // Total attempts made by the user
				},
				429
			);
		}

		// Validate the Content-Type header
		const contentType = request.headers.get('Content-Type');
		if (contentType !== 'application/json') {
			return jsonResponse({ error: 'Invalid Content-Type' }, 400);
		}

		// Parse the request body
		let parsedData;
		try {
			const requestBody = await request.text();
			parsedData = JSON.parse(requestBody);
		} catch (error) {
			console.error('Invalid JSON format:', error);
			return jsonResponse({ error: 'Formato JSON inválido' }, 400);
		}

		const { name, email, mobile, message } = parsedData;

		// Sanitize the form data
		const sanitizedData = {
			name: validator.escape(name),
			email: validator.normalizeEmail(email) || '', // Ensure email is a string
			mobile: validator.escape(mobile),
			message: validator.escape(message),
		};

		// Validate the sanitized data
		const validationError = validateInput(sanitizedData);
		if (Object.keys(validationError).length > 0) {
			return jsonResponse({ error: validationError }, 400);
		}

		// Send the email
		await sendEmail(sanitizedData);

		// Return a successful response with total attempts and remaining points
		return jsonResponse({
			message: 'Email enviado exitosamente',
			totalAttempts,      // Total attempts made by the user
			remainingPoints,    // Remaining points (how many more emails can be sent)
		});
	} catch (error: any) {
		console.error('Error en el envío de correo:', error);
		return jsonResponse({ error: 'Falló el envío de correo' }, 500);
	}
};

export const prerender = false;
