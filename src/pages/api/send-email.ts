// src/pages/api/send-email.ts
import type { APIRoute, APIContext } from 'astro';
import { sendEmail } from '@/services/email-service';
import { validateInput } from '@/utilities/validate-input';
import { getClientIP } from '@/utilities/get-client-ip';
import validator from 'validator';
import { isRateLimited } from '@/utilities/rate-limiter';

const jsonResponse = (data: object, status = 200) => {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
};

export const POST: APIRoute = async ({ request }: APIContext) => {
	try {
		const clientIP = getClientIP(request);

		// Check if the client is rate limited
		const rateLimited = await isRateLimited(clientIP);

		if (rateLimited) {
			console.warn(`Rate limit exceeded for IP: ${clientIP}`);
			return jsonResponse(
				{
					error: 'Has enviado demasiadas solicitudes. Por favor, intenta de nuevo más tarde.',
				},
				429
			);
		}

		// Validate the Content-Type header more flexibly
		const contentType = request.headers.get('Content-Type') || '';
		if (!contentType.includes('application/json')) {
			return jsonResponse({ error: 'Content-Type inválido. Se espera application/json' }, 400);
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

		// Return a successful response
		return jsonResponse({
			message: 'Email enviado exitosamente',
		});
	} catch (error: unknown) {
		console.error('Error en el envío de correo:', error);
		return jsonResponse({ error: 'Falló el envío de correo' }, 500);
	}
};

export const prerender = false;
