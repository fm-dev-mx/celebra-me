import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { generateDraft, getDraft } from '@/lib/intake/services/draft-generation.service';
import { toInvitationContentDraftDTO } from '@/lib/dashboard/dto/intake-mapper';
import { GenerateDraftActionSchema } from '@/lib/intake/schemas/invitation-content-draft.schema';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:draft');
		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const draft = await getDraft(id);

		return jsonResponse({
			draft: draft ? toInvitationContentDraftDTO(draft) : null,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:draft');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const parsed = await validateBodyOrRespond(request, GenerateDraftActionSchema);
		if (parsed instanceof Response) return parsed;

		const draft = await generateDraft(id);

		return jsonResponse({ draft: toInvitationContentDraftDTO(draft) });
	} catch (error) {
		return errorResponse(error);
	}
};
