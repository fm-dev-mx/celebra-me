import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createCommercialSalesOrder } from '@/lib/commercial/orders.service';
import { ORDER_STAGE_VALUES } from '@/lib/commercial/order-payment-status';
import {
	findSalesOrdersByCustomerId,
	listCommercialSalesOrders,
} from '@/lib/commercial/orders.repository';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { resolveAfterResponseContext } from '@/lib/server/platform-request';

const CreateCommercialOrderSchema = z.object({
	customerId: z.string().trim().min(1).max(80),
	leadId: z.string().trim().min(1).max(80).optional(),
	sessionId: z.string().trim().min(1).max(80).optional(),
	sourceEventId: z.string().trim().min(1).max(80).optional(),
	status: z.enum(['quoted', 'confirmed']).optional(),
	eventType: z.string().trim().min(1).max(80),
	packageId: z.string().trim().max(80).optional(),
	packageName: z.string().trim().max(160).optional(),
	currency: z.literal('MXN').optional(),
	totalAmount: z.number().positive(),
	depositAmount: z.number().nonnegative().optional(),
	idempotencyKey: z.uuid(),
	isPastSale: z.boolean().optional(),
	soldAt: z.iso.date().optional(),
	referralCode: z.string().trim().max(32).optional(),
	applyReferralDiscount: z.boolean().optional(),
	applyReferrerCredit: z.boolean().optional(),
	eventDate: z.iso.date().optional(),
});

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:orders:create',
		);

		const parsed = await validateBodyOrRespond(request, CreateCommercialOrderSchema);
		if (parsed instanceof Response) return parsed;

		const order = await createCommercialSalesOrder(
			{
				customerId: parsed.customerId,
				leadId: parsed.leadId,
				sessionId: parsed.sessionId,
				sourceEventId: parsed.sourceEventId,
				status: parsed.status,
				eventType: parsed.eventType,
				packageId: parsed.packageId,
				packageName: parsed.packageName,
				currency: parsed.currency,
				totalAmount: parsed.totalAmount,
				depositAmount: parsed.depositAmount,
				createdBy: session.userId,
				idempotencyKey: parsed.idempotencyKey,
				isPastSale: parsed.isPastSale,
				soldAt: parsed.soldAt ? `${parsed.soldAt}T12:00:00.000Z` : undefined,
				referralCodeUsed: parsed.referralCode || undefined,
				applyReferralDiscount: parsed.applyReferralDiscount,
				applyReferrerCredit: parsed.applyReferrerCredit,
				eventDate: parsed.eventDate,
			},
			{ after: resolveAfterResponseContext(locals) },
		);

		return successResponse(order, 201);
	} catch (error) {
		return errorResponse(error);
	}
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function optionalParam(params: URLSearchParams, name: string): string | undefined {
	return params.get(name) || undefined;
}

function parseOrdersListQuery(params: URLSearchParams) {
	const offset = Number(params.get('offset') ?? '0');
	if (!Number.isSafeInteger(offset) || offset < 0) return badRequest('Página inválida.');
	const status = optionalParam(params, 'status');
	if (status && !['quoted', 'partial', 'paid', 'lost'].includes(status))
		return badRequest('Estado inválido.');
	const stage = optionalParam(params, 'stage');
	if (stage && !ORDER_STAGE_VALUES.includes(stage)) return badRequest('Etapa inválida.');
	const eventFrom = optionalParam(params, 'eventFrom');
	const eventTo = optionalParam(params, 'eventTo');
	if ((eventFrom && !ISO_DATE.test(eventFrom)) || (eventTo && !ISO_DATE.test(eventTo)))
		return badRequest('Fecha inválida.');
	const balance = optionalParam(params, 'balance');
	if (balance && balance !== 'pending' && balance !== 'settled')
		return badRequest('Saldo inválido.');
	return {
		offset,
		status,
		filters: {
			stage,
			eventFrom,
			eventTo,
			balance: balance as 'pending' | 'settled' | undefined,
		},
	};
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'admin:list');
		await requireAdminStrongSession(request);
		if (url.searchParams.get('view') === 'orders') {
			const query = parseOrdersListQuery(url.searchParams);
			if (query instanceof Response) return query;
			return successResponse(
				await listCommercialSalesOrders(query.offset, query.status, query.filters),
			);
		}
		const customerId = url.searchParams.get('customerId')?.trim();
		if (!customerId) {
			return badRequest('Customer ID is required.');
		}

		const rows = await findSalesOrdersByCustomerId(customerId);

		return successResponse(rows);
	} catch (error) {
		return errorResponse(error);
	}
};
