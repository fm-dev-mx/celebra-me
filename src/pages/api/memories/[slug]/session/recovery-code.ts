import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { rotateGuestRecoveryCode } from '@/lib/memories/server/guest-session.service';
import { requireGuestContext } from '@/lib/memories/server/route-guards';

export const prerender = false;

/** Issues a new recovery code for the caller's own session; the previous one stops working. */
export const POST: APIRoute = async ({ request, params }) => {
	try {
		const { space, session } = await requireGuestContext(request, params, 'mutate');
		const recoveryCode = await rotateGuestRecoveryCode(space, session);
		return withPrivateCache(jsonResponse({ recoveryCode }));
	} catch (error) {
		return errorResponse(error);
	}
};
