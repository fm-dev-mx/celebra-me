import type { APIRoute } from 'astro';
import { assertSameOrigin, assertValidClaimCode, enforceAuthRateLimit, sanitizeClaimCode } from '@/lib/rsvp/security/auth-security';
import { validateCsrfToken } from '@/lib/rsvp/security/csrf';
import { requireSessionContext } from '@/lib/rsvp/auth/auth';
import { assertRuntimeMutationEnvironment } from '@/lib/server/runtime-mutation-environment';
import { claimEventForUserByClaimCode } from '@/lib/rsvp/services/auth-access.service';
import { errorResponse, parseJsonBody, successResponse } from '@/lib/rsvp/core/http';

export const POST: APIRoute = async ({ request, url, cookies }) => {
	try {
		assertSameOrigin(request, url.origin);
		const session = await requireSessionContext(request);
		await enforceAuthRateLimit({
			request,
			entityId: `claim:${session.userId}`,
			maxHits: 6,
			windowSec: 60,
		});
		validateCsrfToken(request, cookies);
		await assertRuntimeMutationEnvironment();

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const claimCode = sanitizeClaimCode(bodyResult.claimCode);
		assertValidClaimCode(claimCode);

		const result = await claimEventForUserByClaimCode({
			userId: session.userId,
			claimCode,
		});

		return successResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
