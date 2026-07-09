import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createCommercialSalesOrder } from '@/lib/commercial/orders.service';
import { requireAdminMutationAccess, requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { SalesOrder } from '@/lib/commercial/orders.repository';


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
});

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:orders:create',
		);

		const parsed = await validateBodyOrRespond(request, CreateCommercialOrderSchema);
		if (parsed instanceof Response) return parsed;

		const order = await createCommercialSalesOrder({
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
		});

		return successResponse(order, 201);
	} catch (error) {
		return errorResponse(error);
	}
};

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminStrongSession(request);
		const customerId = url.searchParams.get('customerId')?.trim();
		if (!customerId) {
			return badRequest('Customer ID is required.');
		}

		const rows = await supabaseRestRequest<SalesOrder[]>({
			pathWithQuery: `sales_orders?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc`,
			method: 'GET',
			useServiceRole: true,
		});

		return successResponse(rows);
	} catch (error) {
		return errorResponse(error);
	}
};

