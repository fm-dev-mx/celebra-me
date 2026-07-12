import type { APIRoute } from 'astro';
import { z } from 'zod';
import { markCommercialOrderDepositPaid } from '@/lib/commercial/orders.service';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const MarkDepositPaidSchema = z.object({
	amountPaid: z.number().positive(),
	paidAt: z.iso.datetime().optional(),
	idempotencyKey: z.uuid(),
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:orders:deposit-paid',
		);

		const orderId = params.orderId?.trim();
		if (!orderId) {
			return badRequest('Order id is required.');
		}

		const parsed = await validateBodyOrRespond(request, MarkDepositPaidSchema);
		if (parsed instanceof Response) return parsed;

		const result = await markCommercialOrderDepositPaid({
			orderId,
			amountPaid: parsed.amountPaid,
			paidAt: parsed.paidAt,
			actorId: session.userId,
			idempotencyKey: parsed.idempotencyKey,
		});

		return successResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
