import type { APIRoute } from 'astro';
import { z } from 'zod';
import { sendEmail } from '@/lib/server/email';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, getIp, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { createLeadFromContactSubmission } from '@/lib/tracking/lead.service';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';

const contactSchema = z.object({
	name: z.string().min(2, 'Name is required.').max(160),
	email: z.email('Email format is invalid.').optional().or(z.literal('')),
	phone: z.string().trim().max(40).optional().or(z.literal('')),
	eventType: z.string().trim().max(80).optional().or(z.literal('')),
	eventDate: z.string().trim().max(40).optional().or(z.literal('')),
	packageInterest: z.string().trim().max(80).optional().or(z.literal('')),
	message: z.string().trim().max(2000).optional().or(z.literal('')),
	consentContact: z.coerce.boolean().default(true),
	consentMarketing: z.coerce.boolean().default(false),
	leadCode: z.string().trim().optional(),
	sessionId: z.string().trim().optional(),
	sourceEventId: z.string().trim().optional(),
	visitorId: z.string().trim().min(6).max(120).optional(),
	utmSource: z.string().trim().optional(),
	utmMedium: z.string().trim().optional(),
	utmCampaign: z.string().trim().optional(),
	fbp: z.string().trim().optional(),
	fbc: z.string().trim().optional(),
	fbclid: z.string().trim().optional(),
});

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await validateBodyOrRespond(request, contactSchema);
		if (body instanceof Response) return body;
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'contact:submit',
			ip: getIp(request),
			maxHits: 10,
			windowSec: 60,
		});
		if (!allowed) throw new ApiError(429, 'rate_limited', 'Intente de nuevo en un momento.');
		const { name, email, phone, eventType, eventDate, message } = body;

		const lead = await createLeadFromContactSubmission(body);

		// Send the contact request email through the server mailer.
		const success = await sendEmail({
			name,
			email,
			phone,
			message: [
				message || 'Solicitud desde formulario de contacto.',
				eventType ? `Tipo de evento: ${eventType}` : '',
				eventDate ? `Fecha del evento: ${eventDate}` : '',
				`Código de lead: ${lead.leadCode}`,
			]
				.filter(Boolean)
				.join('\n\n'),
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
