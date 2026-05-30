import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import {
	createClaimCodeAdmin,
	listClaimCodesAdmin,
} from '@/lib/rsvp/services/claim-code-admin.service';
import { findEventByProjectIdService } from '@/lib/rsvp/repositories/event.repository';
import { sanitize } from '@/lib/rsvp/core/utils';

export const GET: APIRoute = async ({ request, url }) => {
	try {
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
		await requireAdminRateLimit(request, 'claimcodes:create');
		const session = await requireAdminStrongSession(request);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const eventIdRaw = sanitize(body.eventId as string, 120);
		const invitationProjectId = sanitize(body.invitationProjectId as string, 120);

		let eventId = eventIdRaw;

		if (!eventId && invitationProjectId) {
			const event = await findEventByProjectIdService(invitationProjectId);
			if (!event) {
				return badRequest('El proyecto de invitación no tiene un evento RSVP asociado.');
			}
			eventId = event.id;
		}

		if (!eventId) return badRequest('eventId o invitationProjectId es requerido.');

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
