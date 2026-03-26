import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { errorResponse, jsonResponse, forbidden } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
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
		// 1. Validate the authenticated host session.
		const session = await requireHostSession(request);

		// 2. Validate the request body.
		const body = await validateBodyOrRespond(request, BulkImportSchema);
		if (body instanceof Response) return body;

		// 3. Verify event ownership before importing guests.
		const events = await supabaseRestRequest<Array<{ id: string }>>({
			pathWithQuery: `events?id=eq.${body.eventId}&owner_user_id=eq.${session.userId}&select=id`,
			method: 'GET',
			authToken: session.accessToken,
		});

		if (events.length === 0) {
			return forbidden('Event not found or access denied.');
		}

		// 4. Call the bulk upsert RPC.
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
			message: 'Import completed successfully.',
		});
	} catch (err) {
		console.error('[BulkImport] Error:', err);
		return errorResponse(err);
	}
};
