import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findInvitationProjectById,
	updateInvitationProject,
} from '@/lib/intake/repositories/invitation-project.repository';
import {
	getIntakeRequestsByProjectId,
	updateRequest,
} from '@/lib/intake/services/intake-request.service';
import {
	getSubmissionByRequestId,
	approveSubmission,
	requestChanges,
	updateSubmissionCorrections,
} from '@/lib/intake/services/intake-submission.service';
import {
	ReviewIntakeSchema,
	UpdateAdminSubmissionSchema,
} from '@/lib/intake/schemas/intake-submission.schema';
import {
	toInvitationProjectDTO,
	toIntakeRequestDTO,
	toIntakeSubmissionDTO,
} from '@/lib/dashboard/dto/intake-mapper';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:review');
		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const project = await findInvitationProjectById(id);
		if (!project) throw new ApiError(404, 'not_found', 'Invitation project not found.');

		const requests = await getIntakeRequestsByProjectId(id, 'client');
		const activeRequest = requests[0] ?? null;

		if (!activeRequest) {
			throw new ApiError(404, 'not_found', 'No intake request found for this project.');
		}

		const submission = await getSubmissionByRequestId(activeRequest.id);
		if (!submission) {
			throw new ApiError(404, 'not_found', 'No submission found for this request.');
		}

		if (project.status === 'client_submitted') {
			await updateInvitationProject(id, { status: 'in_review' });
			project.status = 'in_review';
		}

		return jsonResponse({
			item: toInvitationProjectDTO(project),
			request: toIntakeRequestDTO(activeRequest),
			submission: toIntakeSubmissionDTO(submission),
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:review');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const parsed = await validateBodyOrRespond(request, ReviewIntakeSchema);
		if (parsed instanceof Response) return parsed;

		const project = await findInvitationProjectById(id);
		if (!project) throw new ApiError(404, 'not_found', 'Invitation project not found.');

		const requests = await getIntakeRequestsByProjectId(id, 'client');
		const activeRequest = requests[0];
		if (!activeRequest) {
			throw new ApiError(404, 'not_found', 'No intake request found for this project.');
		}

		const submission = await getSubmissionByRequestId(activeRequest.id);
		if (!submission) {
			throw new ApiError(404, 'not_found', 'No submission found for this request.');
		}

		let updatedSubmission;

		if (parsed.action === 'approve') {
			updatedSubmission = await approveSubmission(submission.id, parsed.reviewNotes);
			await updateInvitationProject(id, { status: 'in_production' });
		} else {
			updatedSubmission = await requestChanges(submission.id, parsed.reviewNotes ?? '');
			await updateInvitationProject(id, { status: 'waiting_for_client' });
			await updateRequest(activeRequest.id, { status: 'active' });
		}

		return jsonResponse({ item: toIntakeSubmissionDTO(updatedSubmission) });
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:review');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');

		const parsed = await validateBodyOrRespond(request, UpdateAdminSubmissionSchema);
		if (parsed instanceof Response) return parsed;

		const requests = await getIntakeRequestsByProjectId(id, 'client');
		const activeRequest = requests[0];
		if (!activeRequest) {
			throw new ApiError(404, 'not_found', 'No intake request found for this project.');
		}

		const submission = await getSubmissionByRequestId(activeRequest.id);
		if (!submission) {
			throw new ApiError(404, 'not_found', 'No submission found for this request.');
		}

		const updated = await updateSubmissionCorrections(
			submission.id,
			activeRequest.enabledBlocks,
			parsed.blockData,
			parsed.clientComments,
		);

		return jsonResponse({ item: toIntakeSubmissionDTO(updated) });
	} catch (error) {
		return errorResponse(error);
	}
};
