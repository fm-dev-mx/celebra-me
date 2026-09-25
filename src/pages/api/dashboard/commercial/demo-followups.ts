import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { DemoFollowupSchema } from '@/lib/commercial/demo-followup';
import { recordDemoFollowup } from '@/lib/commercial/demo-followup.service';

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:demo-followups:write',
		);
		const input = await validateBodyOrRespond(request, DemoFollowupSchema);
		if (input instanceof Response) return input;
		return successResponse(await recordDemoFollowup(input, session.userId));
	} catch (error) {
		return errorResponse(error);
	}
};
