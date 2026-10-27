import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createCommercialCustomer } from '@/lib/commercial/customer.service';
import {
	findCommercialCustomerById,
	findCommercialCustomerByPhone,
	findCommercialCustomerByEmail,
} from '@/lib/commercial/customer.repository';
import { normalizeCommercialPhone, normalizeCommercialEmail } from '@/lib/commercial/phone';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond, validateQueryOrRespond } from '@/lib/rsvp/core/validation';

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

		const result = await createCommercialCustomer({
			displayName: parsed.displayName,
			email: parsed.email,
			phone: parsed.phone,
			createdFromLeadId: parsed.createdFromLeadId,
		});

		return successResponse(result, result.outcome === 'created' ? 201 : 200);
	} catch (error) {
		if (error instanceof ApiError) {
			return errorResponse(error);
		}

		const message = error instanceof Error ? error.message : '';
		// Catch raw Supabase constraint violations so they are never
		// exposed to the operator.
		if (/duplicate key|unique constraint/i.test(message)) {
			return errorResponse(
				new ApiError(
					409,
					'conflict',
					'Ya existe un cliente registrado con ese correo electrónico o teléfono. Se seleccionó el cliente existente.',
				),
			);
		}

		return errorResponse(
			new ApiError(500, 'internal_error', 'Error al crear el cliente. Intenta de nuevo.'),
		);
	}
};

const GetCustomerQuerySchema = z.object({
	id: z.string().trim().min(1).max(80),
});

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'commercial:customers:search');
		await requireAdminStrongSession(request);
		if (url.searchParams.has('phone') || url.searchParams.has('email')) {
			const query = validateQueryOrRespond(
				url.searchParams,
				z.object({
					phone: z.string().trim().max(60).optional(),
					email: z.email().max(160).optional(),
				}),
			);
			if (query instanceof Response) return query;
			const phone = normalizeCommercialPhone(query.phone);
			const email = normalizeCommercialEmail(query.email);
			if (!phone && !email)
				return errorResponse(
					new ApiError(400, 'validation_error', 'Indique un teléfono o correo válido.'),
				);
			const matches = await Promise.all([
				phone ? findCommercialCustomerByPhone(phone.e164) : null,
				email ? findCommercialCustomerByEmail(email) : null,
			]);
			return successResponse(
				matches.filter(
					(item, index) =>
						item && matches.findIndex((other) => other?.id === item.id) === index,
				),
			);
		}

		const parsed = validateQueryOrRespond(url.searchParams, GetCustomerQuerySchema);
		if (parsed instanceof Response) return parsed;

		const customer = await findCommercialCustomerById(parsed.id);
		if (!customer) {
			return errorResponse(new ApiError(404, 'not_found', 'Cliente no encontrado.'));
		}

		return successResponse(customer);
	} catch (error) {
		if (error instanceof ApiError) {
			return errorResponse(error);
		}
		return errorResponse(new ApiError(500, 'internal_error', 'Error al obtener el cliente.'));
	}
};
