import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { badRequest, errorResponse, getIp, jsonResponse, forbidden } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { formatPhoneError, normalizeOptionalNationalPhone } from '@/lib/rsvp/core/utils';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { findEventById, findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { ApiError, isApiError } from '@/lib/rsvp/core/errors';
import { z } from 'zod';

const BulkGuestSchema = z.object({
	full_name: z.string().min(1),
	phone: z.string().optional().nullable(),
	country_code: z.string().optional().nullable(),
	email: z.email().optional().nullable(),
	tags: z.array(z.string()).optional(),
	max_allowed_attendees: z.number().optional().default(2),
});

const BulkImportSchema = z.object({
	eventId: z.uuid(),
	guests: z.array(BulkGuestSchema),
});

export const POST: APIRoute = async ({ request }) => {
	try {
		const session = await requireHostSession(request);

		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `bulk_import:${session.userId}`,
			ip: getIp(request),
			maxHits: 10,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Too many requests.');
		}

		const body = await validateBodyOrRespond(request, BulkImportSchema);
		if (body instanceof Response) return body;

		const eventRecord = await findEventById(body.eventId, session.accessToken);
		if (!eventRecord) {
			const serviceEvent = await findEventByIdService(body.eventId);
			if (serviceEvent) {
				return forbidden('Event not found or access denied.');
			}
			return errorResponse(new ApiError(404, 'not_found', 'Event not found.'));
		}

		const rowErrors: string[] = [];
		const normalizedGuests = body.guests.map((guest, i) => {
			const phoneResult = normalizeOptionalNationalPhone(guest.phone);
			if (!phoneResult.ok) {
				const reason =
					phoneResult.reason === 'country_code_in_phone'
						? 'No incluyas el código de país en el teléfono. Usa la columna clave_pais.'
						: formatPhoneError(phoneResult.reason);
				rowErrors.push(`Fila ${i + 1}: ${reason}`);
				return null;
			}
			return {
				full_name: guest.full_name,
				phone: phoneResult.phone,
				country_code: guest.country_code ?? null,
				email: guest.email ?? null,
				tags: guest.tags ?? [],
				max_allowed_attendees: guest.max_allowed_attendees,
			};
		});

		if (rowErrors.length > 0) {
			const message = `No se pudieron procesar ${rowErrors.length} fila${rowErrors.length !== 1 ? 's' : ''}.`;
			return errorResponse(new ApiError(400, 'bad_request', message, { rows: rowErrors }));
		}

		const data = await supabaseRestRequest({
			pathWithQuery: `rpc/upsert_guests_v1`,
			method: 'POST',
			body: {
				p_event_id: body.eventId,
				p_guests: normalizedGuests,
			},
			authToken: session.accessToken,
		});

		return jsonResponse({
			data,
			message: 'Importación completada correctamente.',
		});
	} catch (err) {
		console.error('[rsvp] [BulkImport] Error:', err);
		if (isApiError(err)) {
			return errorResponse(err);
		}
		const message = err instanceof Error ? err.message : String(err);
		const supabaseMatch = message.match(/^Supabase error \((\d+)\):/);
		if (supabaseMatch) {
			const supabaseStatus = parseInt(supabaseMatch[1], 10);
			if (supabaseStatus >= 400 && supabaseStatus < 500) {
				return badRequest(message);
			}
		}
		return errorResponse(new ApiError(500, 'internal_error', message));
	}
};
