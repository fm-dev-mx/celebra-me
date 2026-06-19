import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import {
	getEnrichedInvitationList,
	createInvitation,
	synchronizeDemoInvitations,
} from '@/lib/intake/services/invitation.service';
import { CreateInvitationSchema } from '@/lib/intake/schemas/invitation.schema';
import { toInvitationDTO } from '@/lib/dashboard/dto/intake-mapper';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		const session = await requireAdminStrongSession(request);

		const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true';
		await synchronizeDemoInvitations(session.userId);
		const items = await getEnrichedInvitationList(includeArchived ? 'all' : 'active');

		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:create');

		const parsed = await validateBodyOrRespond(request, CreateInvitationSchema);
		if (parsed instanceof Response) return parsed;

		const invitation = await createInvitation({
			title: parsed.title,
			eventType: parsed.eventType,
			baseDemoId: parsed.baseDemoId,
			slug: parsed.slug,
			clientName: parsed.clientName,
			clientEmail: parsed.clientEmail,
			clientWhatsapp: parsed.clientWhatsapp,
			createdBy: session.userId,
		});

		return jsonResponse({ item: toInvitationDTO(invitation) }, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
