import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
	getCommercialOrderDetail,
	updateCommercialOrderEventDate,
} from '@/lib/commercial/orders.service';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const EventDateSchema = z.object({ eventDate: z.iso.date().nullable() });

/** The order with its payment history and the seven-stage line. */
export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminStrongSession(request);
		if (!z.uuid().safeParse(params.orderId).success) return badRequest('Pedido inválido.');
		return withPrivateCache(successResponse(await getCommercialOrderDetail(params.orderId!)));
	} catch (error) {
		return errorResponse(error);
	}
};

/** Sets or clears the date of the celebration. */
export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'commercial:orders:event-date');
		if (!z.uuid().safeParse(params.orderId).success) return badRequest('Pedido inválido.');
		const parsed = await validateBodyOrRespond(request, EventDateSchema);
		if (parsed instanceof Response) return parsed;
		return successResponse(
			await updateCommercialOrderEventDate(params.orderId!, parsed.eventDate),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
