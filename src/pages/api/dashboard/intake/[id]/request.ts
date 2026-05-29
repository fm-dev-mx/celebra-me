import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	getInvitationProjectById,
	updateProject,
} from '@/lib/intake/services/invitation-project.service';
import {
	getIntakeRequestsByProjectId,
	createRequest,
} from '@/lib/intake/services/intake-request.service';
import { CreateIntakeRequestSchema } from '@/lib/intake/schemas/intake-request.schema';
import { toIntakeRequestDTO } from '@/lib/dashboard/dto/intake-mapper';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const requests = await getIntakeRequestsByProjectId(id);
		const items = requests.map(toIntakeRequestDTO);

		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:request');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const project = await getInvitationProjectById(id);
		if (!project) throw new ApiError(404, 'not_found', 'Invitation project not found.');

		const parsed = await validateBodyOrRespond(request, CreateIntakeRequestSchema);
		if (parsed instanceof Response) return parsed;

		const result = await createRequest({
			invitationProjectId: id,
			enabledBlocks: parsed.enabledBlocks,
			expiresInDays: parsed.expiresInDays,
		});

		if (project.status === 'draft') {
			await updateProject(id, { status: 'waiting_for_client' });
		}

		return jsonResponse(
			{
				request: toIntakeRequestDTO(result.request),
				rawToken: result.rawToken,
			},
			201,
		);
	} catch (error) {
		return errorResponse(error);
	}
};
