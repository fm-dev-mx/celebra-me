import type { APIRoute } from 'astro';
import { listInvitationDataInbox } from '@/lib/invitation-data/service';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';

/** Invitation data forms received and not reviewed since their latest save. */
export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminStrongSession(request);
		return successResponse(await listInvitationDataInbox());
	} catch (error) {
		return errorResponse(error);
	}
};
