import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	ensureInternalEditContext,
	saveInternalComments,
} from '@/lib/intake/services/internal-edit.service';
import { saveSubmissionStep } from '@/lib/intake/services/intake-submission.service';
import {
	SaveIntakeStepSchema,
	SubmitIntakeSchema,
} from '@/lib/intake/schemas/intake-submission.schema';
import { toIntakeSubmissionDTO } from '@/lib/dashboard/dto/intake-mapper';

function requireProjectId(id: string | undefined): string {
	if (!id) throw new ApiError(400, 'bad_request', 'Project ID is required.');
	return id;
}

async function requireMutationAccess(request: Request, cookies: AstroCookies) {
	await requireAdminRateLimit(request, 'intake:edit');
	if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
		validateCsrfToken(request, cookies);
	}
	await requireAdminStrongSession(request);
}

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:edit');
		await requireAdminStrongSession(request);
		const ctx = await ensureInternalEditContext(requireProjectId(params.id));

		return jsonResponse({
			project: {
				id: ctx.project.id,
				title: ctx.project.title,
				eventType: ctx.project.eventType,
				status: ctx.project.status,
			},
			request: {
				id: ctx.request.id,
				enabledBlocks: ctx.request.enabledBlocks,
			},
			submission: toIntakeSubmissionDTO(ctx.submission),
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireMutationAccess(request, cookies);
		const projectId = requireProjectId(params.id);
		const ctx = await ensureInternalEditContext(projectId);
		const parsed = await validateBodyOrRespond(request, SaveIntakeStepSchema);
		if (parsed instanceof Response) return parsed;

		const updated = await saveSubmissionStep(
			ctx.submission.id,
			parsed.blockType,
			parsed.blockData,
			true,
		);
		return jsonResponse({ item: toIntakeSubmissionDTO(updated) });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireMutationAccess(request, cookies);
		const ctx = await ensureInternalEditContext(requireProjectId(params.id));
		const parsed = await validateBodyOrRespond(request, SubmitIntakeSchema);
		if (parsed instanceof Response) return parsed;

		const updated = await saveInternalComments(ctx.submission.id, parsed.clientComments);
		return jsonResponse({ item: toIntakeSubmissionDTO(updated) });
	} catch (error) {
		return errorResponse(error);
	}
};
