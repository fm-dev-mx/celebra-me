import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { synchronizeDemoInvitations } from '@/lib/intake/services/invitation.service';

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:update');
		await synchronizeDemoInvitations(session.userId);
		return jsonResponse({ synchronized: true });
	} catch (error) {
		return errorResponse(error);
	}
};
