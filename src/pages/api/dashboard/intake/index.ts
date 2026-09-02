import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import {
	assertCreateInvitationPreset,
	getEnrichedInvitationList,
} from '@/lib/intake/services/invitation.service';
import { rejectDashboardClientInvitationCreation } from '@/lib/intake/services/dashboard-client-creation-policy';
import { CreateInvitationSchema } from '@/lib/intake/schemas/invitation.schema';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);

		const url = new URL(request.url);
		const includeArchived = url.searchParams.get('includeArchived') === 'true';
		const items = await getEnrichedInvitationList(includeArchived ? 'all' : 'active');

		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:create');

		const parsed = await validateBodyOrRespond(request, CreateInvitationSchema);
		if (parsed instanceof Response) return parsed;

		// Preserve preset invariant errors, then deny Dashboard client creation.
		assertCreateInvitationPreset({
			eventType: parsed.eventType,
			baseDemoId: parsed.baseDemoId,
		});
		rejectDashboardClientInvitationCreation({ via: 'create' });
	} catch (error) {
		return errorResponse(error);
	}
};
