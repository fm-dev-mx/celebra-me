import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/admin-rate-limit';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/http';
import { createClaimCodeAdmin, listClaimCodesAdmin } from '@/lib/rsvp/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		// Rate limiting: 60 req/min para listados
		await requireAdminRateLimit(request, 'claimcodes:list');
		await requireAdminStrongSession(request);
		const eventId = sanitize(url.searchParams.get('eventId'), 120);
		const items = await listClaimCodesAdmin({ eventId: eventId || undefined });
		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		// Rate limiting: 20 req/min para creación
		await requireAdminRateLimit(request, 'claimcodes:create');
		const session = await requireAdminStrongSession(request);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;
		const eventId = sanitize(body.eventId as string, 120);
		if (!eventId) return badRequest('eventId es obligatorio.');
		const created = await createClaimCodeAdmin({
			eventId,
			expiresAt:
				typeof body.expiresAt === 'string' || body.expiresAt === null
					? body.expiresAt
					: null,
			maxUses: typeof body.maxUses === 'number' ? body.maxUses : undefined,
			createdBy: session.userId,
		});
		return jsonResponse(created, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
