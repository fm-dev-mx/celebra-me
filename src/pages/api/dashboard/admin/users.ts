import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond, validateQueryOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { createAdminUser, listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { CreateUserSchema, PaginationSchema } from '@/lib/schemas';

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'admin:list');
		await requireAdminStrongSession(request);

		const parsed = validateQueryOrRespond(url.searchParams, PaginationSchema);
		if (parsed instanceof Response) return parsed;

		const items = await listAdminUsers({ page: parsed.page, perPage: parsed.perPage });
		return jsonResponse({
			items,
			total: items.length,
			page: parsed.page,
			perPage: parsed.perPage,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'admin:create');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		const session = await requireAdminStrongSession(request);

		const parsed = await validateBodyOrRespond(request, CreateUserSchema);
		if (parsed instanceof Response) return parsed;

		const createdUser = await createAdminUser({
			email: parsed.email,
			role: parsed.role,
			actorUserId: session.userId,
		});

		return jsonResponse(createdUser, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
