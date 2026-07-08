import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const CreateCommercialCustomerSchema = z.object({
	displayName: z.string().trim().min(1).max(160),
	email: z.email().optional().or(z.literal('')),
	phone: z.string().trim().max(60).optional().or(z.literal('')),
	createdFromLeadId: z.string().trim().min(1).max(80).optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'commercial:customers:create');

		const parsed = await validateBodyOrRespond(request, CreateCommercialCustomerSchema);
		if (parsed instanceof Response) return parsed;

		const customer = await createCommercialCustomer({
			displayName: parsed.displayName,
			email: parsed.email,
			phone: parsed.phone,
			createdFromLeadId: parsed.createdFromLeadId,
		});

		return successResponse(customer, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
