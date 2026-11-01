import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createOrderDraft, getOrderDraftOptions } from '@/lib/invitation-data/draft-service';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const InputSchema = z.object({ themeId: z.string().min(1).max(80) }).strict();

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminStrongSession(request);
		if (!z.uuid().safeParse(params.orderId).success) return badRequest('Pedido inválido.');
		return withPrivateCache(successResponse(await getOrderDraftOptions(params.orderId!)));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'commercial:invitation-data:write');
		if (!z.uuid().safeParse(params.orderId).success) return badRequest('Pedido inválido.');
		const input = await validateBodyOrRespond(request, InputSchema);
		if (input instanceof Response) return input;
		const result = await createOrderDraft(params.orderId!, input.themeId);
		return withPrivateCache(successResponse(result, result.created ? 201 : 200));
	} catch (error) {
		return errorResponse(error);
	}
};
