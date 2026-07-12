import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateQueryOrRespond } from '@/lib/rsvp/core/validation';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const ConversionStatusQuerySchema = z.object({
	id: z.string().trim().min(1).max(80),
});

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminStrongSession(request);

		const parsed = validateQueryOrRespond(url.searchParams, ConversionStatusQuerySchema);
		if (parsed instanceof Response) return parsed;

		const rows = await supabaseRestRequest<{ id: string; status: string }[]>({
			pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(parsed.id)}&select=id,status&limit=1`,
			method: 'GET',
			useServiceRole: true,
		});

		if (rows.length === 0) {
			return errorResponse(new ApiError(404, 'not_found', 'Evento de conversión no encontrado.'));
		}

		return successResponse({ status: rows[0].status });
	} catch (error) {
		if (error instanceof ApiError) {
			return errorResponse(error);
		}
		return errorResponse(
			new ApiError(500, 'internal_error', 'Error al consultar el estado de conversión.'),
		);
	}
};
