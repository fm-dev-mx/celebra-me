import { canRecordOwnerReview } from '@/lib/intake/workflow';
import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { getEnrichedInvitationList } from '@/lib/intake/services/invitation.service';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		const session = await requireAdminStrongSession(request);

		const url = new URL(request.url);
		const includeArchived = url.searchParams.get('includeArchived') === 'true';
		const items = await getEnrichedInvitationList(includeArchived ? 'all' : 'active');

		return jsonResponse({
			items,
			canReviewManually: canRecordOwnerReview(session.email),
		});
	} catch (error) {
		return errorResponse(error);
	}
};
