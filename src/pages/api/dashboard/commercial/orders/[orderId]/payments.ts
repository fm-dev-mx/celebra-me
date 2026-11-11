import type { APIRoute } from 'astro';
import { z } from 'zod';
import { registerCommercialOrderPayment } from '@/lib/commercial/orders.service';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const RegisterPaymentSchema = z.object({
	amount: z.number().positive(),
	paidAt: z.iso.datetime().optional(),
	idempotencyKey: z.uuid(),
});

/** Records an installment or the settlement of an order that already holds its deposit. */
export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:orders:payments',
		);
		const orderId = params.orderId?.trim();
		if (!orderId || !z.uuid().safeParse(orderId).success) return badRequest('Pedido inválido.');

		const parsed = await validateBodyOrRespond(request, RegisterPaymentSchema);
		if (parsed instanceof Response) return parsed;

		return successResponse(
			await registerCommercialOrderPayment({
				orderId,
				amount: parsed.amount,
				paidAt: parsed.paidAt,
				actorId: session.userId,
				idempotencyKey: parsed.idempotencyKey,
			}),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
