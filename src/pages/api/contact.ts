import type { APIRoute } from 'astro';
import { z } from 'zod';
import { sendEmail } from '@/lib/server/email';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { createLeadFromContactSubmission } from '@/lib/tracking/lead.service';

const contactSchema = z.object({
	name: z.string().min(2, 'Name is required.').max(160),
	email: z.email('Email format is invalid.'),
	phone: z.string().trim().max(40).optional().or(z.literal('')),
	eventType: z.string().trim().max(80).optional().or(z.literal('')),
	packageInterest: z.string().trim().max(80).optional().or(z.literal('')),
	message: z.string().min(10, 'Message is required.'),
	consentContact: z.coerce.boolean().default(true),
	consentMarketing: z.coerce.boolean().default(false),
	leadCode: z.string().trim().optional(),
	sessionId: z.string().trim().optional(),
	sourceEventId: z.string().trim().optional(),
	visitorId: z.string().trim().min(6).max(120).optional(),
	utmSource: z.string().trim().optional(),
	utmMedium: z.string().trim().optional(),
	utmCampaign: z.string().trim().optional(),
});

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await validateBodyOrRespond(request, contactSchema);
		if (body instanceof Response) return body;
		const { name, email, message } = body;

		const lead = await createLeadFromContactSubmission(body);

		// Send the contact request email through the server mailer.
		const success = await sendEmail({
			name,
			email,
			message: `${message}\n\nCódigo de lead: ${lead.leadCode}`,
			type: 'contact',
		});

		if (success) {
			return successResponse({
				message: 'Message sent successfully.',
				leadCode: lead.leadCode,
			});
		}
		return errorResponse(new ApiError(500, 'internal_error', 'Failed to send email.'));
	} catch (error) {
		return errorResponse(error);
	}
};
