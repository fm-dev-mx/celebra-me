// src/pages/api/sendEmail.ts
import type { APIRoute, APIContext } from 'astro';
import { sendEmail } from '@/services/emailService';
import { validateInput } from '@/utilities/validateInput';
import { getClientIp } from '@/utilities/getClientIp';
import validator from 'validator';
import { isRateLimited } from '@/utilities/rateLimiter';

const jsonResponse = (data: Record<string, unknown>, status = 200) => {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
};

export const POST: APIRoute = async ({ request }: APIContext) => {
	try {
		const clientIP = getClientIp(request);

		// Check if the client is rate limited
		const rateLimited = await isRateLimited(clientIP);

		if (rateLimited) {
			console.warn(`Rate limit exceeded for IP: ${clientIP}`);
			return jsonResponse(
				{
					error: 'You have sent too many requests. Please try again later.',
				},
				429
			);
		}

		// Validate the Content-Type header
		const contentType = request.headers.get('Content-Type') || '';
		if (!contentType.includes('application/json')) {
			return jsonResponse({ error: 'Invalid Content-Type. Expected application/json' }, 400);
		}

		// Parse the request body
		let parsedData;
		try {
			const requestBody = await request.text();
			parsedData = JSON.parse(requestBody);
		} catch (error) {
			console.error('Invalid JSON format:', error);
			return jsonResponse({ error: 'Invalid JSON format' }, 400);
		}

		const { name, email, mobile, message } = parsedData;

		// Validate the raw data before sanitization
		const validationError = validateInput({ name, email, mobile, message });
		if (Object.keys(validationError).length > 0) {
			return jsonResponse({ error: 'Validation errors', fieldErrors: validationError }, 400);
		}

		// Sanitize the form data
		const sanitizedData = {
			name: validator.escape(name),
			email: validator.normalizeEmail(email) || '', // Ensure email is a string
			mobile: validator.escape(mobile),
			message: validator.escape(message),
		};

		// Send the email
		await sendEmail(sanitizedData);

		// Return a successful response
		return jsonResponse({
			message: 'Email enviado exitosamente',
		});
	} catch (error: unknown) {
		console.error('Error sending email:', error);
		return jsonResponse({ error: 'Falló el envío de correo' }, 500);
	}
};

export const prerender = false;
