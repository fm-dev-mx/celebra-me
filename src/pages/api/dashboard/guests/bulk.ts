import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { badRequest, errorResponse, jsonResponse, forbidden } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { normalizeImportedPhone } from '@/lib/rsvp/core/utils';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { findEventById, findEventByIdService } from '@/lib/rsvp/repositories/event.repository';
import { ApiError, isApiError } from '@/lib/rsvp/core/errors';
import { z } from 'zod';

const BulkGuestSchema = z.object({
	full_name: z.string().min(1),
	phone: z.string().optional().default(''),
	country_code: z.string().optional(),
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
			try {
				const phone = guest.phone
					? normalizeImportedPhone(guest.phone, guest.country_code)
					: '';
				return {
					full_name: guest.full_name,
					phone,
					email: guest.email ?? null,
					tags: guest.tags ?? [],
					max_allowed_attendees: guest.max_allowed_attendees,
				};
			} catch (err) {
				rowErrors.push(
					`Fila ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
				);
				return null;
			}
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
