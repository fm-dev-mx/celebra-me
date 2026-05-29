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
import { getIntakeRequestsByProjectId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import { UpdateInvitationProjectSchema } from '@/lib/intake/schemas/invitation-project.schema';
import {
	toInvitationProjectDTO,
	toIntakeRequestDTO,
	toIntakeSubmissionDTO,
} from '@/lib/dashboard/dto/intake-mapper';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const project = await getInvitationProjectById(id);
		if (!project) throw new ApiError(404, 'not_found', 'Invitation project not found.');

		const requests = await getIntakeRequestsByProjectId(id);
		const activeRequest = requests[0] ?? null;

		let submission = null;
		if (activeRequest) {
			const sub = await getSubmissionByRequestId(activeRequest.id);
			if (sub) submission = toIntakeSubmissionDTO(sub);
		}

		return jsonResponse({
			item: toInvitationProjectDTO(project),
			request: activeRequest ? toIntakeRequestDTO(activeRequest) : null,
			submission,
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:update');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const parsed = await validateBodyOrRespond(request, UpdateInvitationProjectSchema);
		if (parsed instanceof Response) return parsed;

		const project = await updateProject(id, parsed);

		return jsonResponse({ item: toInvitationProjectDTO(project) });
	} catch (error) {
		return errorResponse(error);
	}
};
