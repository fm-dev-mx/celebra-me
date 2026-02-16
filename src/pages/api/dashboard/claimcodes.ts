import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp-v2/authorization';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { createClaimCodeAdmin, listClaimCodesAdmin } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
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
		const session = await requireAdminStrongSession(request);
		const body = (await request.json()) as {
			eventId?: string;
			expiresAt?: string | null;
			maxUses?: number;
		};
		const eventId = sanitize(body.eventId, 120);
		if (!eventId) return badRequest('eventId es obligatorio.');
		const created = await createClaimCodeAdmin({
			eventId,
			expiresAt: body.expiresAt ?? null,
			maxUses: body.maxUses,
			createdBy: session.userId,
		});
		return jsonResponse(created, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
