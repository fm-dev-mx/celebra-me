import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
	getInvitationDataSummary,
	issueInvitationDataLink,
	markInvitationDataAsReviewed,
} from '@/lib/invitation-data/service';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { badRequest, errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const ActionSchema = z.object({
	action: z.enum(['issue-link', 'mark-reviewed']),
});

/** The order's private invitation data form: its state and the client's answers. */
export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminStrongSession(request);
		const orderId = params.orderId?.trim();
		if (!orderId) return badRequest('Order id is required.');
		return successResponse(await getInvitationDataSummary(orderId));
	} catch (error) {
		return errorResponse(error);
	}
};

/**
 * `issue-link` creates or replaces the private link (the previous one stops working) and returns
 * it once with its prefilled WhatsApp message; `mark-reviewed` clears the dashboard notice.
 */
export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'commercial:invitation-data:write',
		);
		const orderId = params.orderId?.trim();
		if (!orderId) return badRequest('Order id is required.');

		const parsed = await validateBodyOrRespond(request, ActionSchema);
		if (parsed instanceof Response) return parsed;

		if (parsed.action === 'mark-reviewed') {
			return successResponse(await markInvitationDataAsReviewed(orderId));
		}
		const link = await issueInvitationDataLink({
			orderId,
			origin: new URL(request.url).origin,
			actorId: session.userId,
		});
		return successResponse(
			{
				url: link.url,
				whatsappUrl: link.whatsappUrl,
				expiresAt: link.expiresAt,
				summary: await getInvitationDataSummary(orderId),
			},
			201,
		);
	} catch (error) {
		return errorResponse(error);
	}
};
