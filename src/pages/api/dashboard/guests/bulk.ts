import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { errorResponse, jsonResponse, forbidden } from '@/lib/rsvp/core/http';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { validateBody } from '@utils/api-utils';
import { z } from 'zod';

const BulkImportSchema = z.object({
	eventId: z.uuid(),
	guests: z.array(
		z.object({
			full_name: z.string(),
			phone: z.string().optional(),
			email: z.email().optional().nullable(),
			tags: z.array(z.string()).optional(),
			max_allowed_attendees: z.number().optional().default(2),
		}),
	),
});

export const POST: APIRoute = async ({ request }) => {
	try {
		// 1. Verificar sesión (patrón rsvp)
		const session = await requireHostSession(request);

		// 2. Validar cuerpo
		const body = await validateBody(request, BulkImportSchema);

		// 3. Verificar propiedad del evento usando REST
		const events = await supabaseRestRequest<Array<{ id: string }>>({
			pathWithQuery: `events?id=eq.${body.eventId}&owner_user_id=eq.${session.userId}&select=id`,
			method: 'GET',
			authToken: session.accessToken,
		});

		if (events.length === 0) {
			return forbidden('Evento no encontrado o no tienes permisos.');
		}

		// 4. Llamar RPC (POST a /rpc/name)
		const data = await supabaseRestRequest({
			pathWithQuery: `rpc/upsert_guests_v1`,
			method: 'POST',
			body: {
				p_event_id: body.eventId,
				p_guests: body.guests,
			},
			authToken: session.accessToken,
		});

		return jsonResponse({
			data,
			message: 'Importación completada con éxito.',
		});
	} catch (err) {
		console.error('[BulkImport] Error:', err);
		return errorResponse(err);
	}
};
