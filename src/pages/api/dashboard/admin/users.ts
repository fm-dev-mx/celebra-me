import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateQueryOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { listAdminUsers } from '@/lib/rsvp/services/user-admin.service';
import { PaginationSchema } from '@/lib/schemas';

export const GET: APIRoute = async ({ request, url }) => {
	try {
		await requireAdminRateLimit(request, 'admin:list');
		await requireAdminStrongSession(request);

		const parsed = validateQueryOrRespond(url.searchParams, PaginationSchema);
		if (parsed instanceof Response) return parsed;

		const items = await listAdminUsers({ page: parsed.page, perPage: parsed.perPage });
		return jsonResponse({ items, page: parsed.page, perPage: parsed.perPage });
	} catch (error) {
		return errorResponse(error);
	}
};
