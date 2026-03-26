import type { APIRoute } from 'astro';
import { z } from 'zod';
import { sendEmail } from '@/lib/server/email';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const contactSchema = z.object({
	name: z.string().min(6, 'Name is required.'),
	email: z.email('Email format is invalid.'),
	message: z.string().min(10, 'Message is required.'),
});

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await validateBodyOrRespond(request, contactSchema);
		if (body instanceof Response) return body;
		const { name, email, message } = body;

		// Send the contact request email through the server mailer.
		const success = await sendEmail({
			name,
			email,
			message,
			type: 'contact',
		});

		if (success) {
			return successResponse({ message: 'Message sent successfully.' });
		}
		return errorResponse(new ApiError(500, 'internal_error', 'Failed to send email.'));
	} catch (error) {
		return errorResponse(error);
	}
};
