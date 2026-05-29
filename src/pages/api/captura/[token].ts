import type { APIRoute } from 'astro';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { hashIntakeToken } from '@/lib/intake/services/intake-token.service';
import { findIntakeRequestByTokenHash } from '@/lib/intake/repositories/intake-request.repository';
import { findInvitationProjectById } from '@/lib/intake/repositories/invitation-project.repository';
import { updateInvitationProject } from '@/lib/intake/repositories/invitation-project.repository';
import {
	findSubmissionByRequestId,
	createIntakeSubmission,
} from '@/lib/intake/repositories/intake-submission.repository';
import { updateIntakeRequest } from '@/lib/intake/repositories/intake-request.repository';
import {
	saveSubmissionStep,
	submitSubmission,
} from '@/lib/intake/services/intake-submission.service';
import {
	SaveIntakeStepSchema,
	SubmitIntakeSchema,
	validateBlockData,
} from '@/lib/intake/schemas/intake-submission.schema';
import { sendIntakeNotification } from '@/lib/server/email';
import { getEnv } from '@/lib/server/env';
import { toIntakeSubmissionDTO } from '@/lib/dashboard/dto/intake-mapper';
import type { IntakeBlockType } from '@/lib/intake/types';

interface ResolvedContext {
	request: Awaited<ReturnType<typeof findIntakeRequestByTokenHash>>;
	project: Awaited<ReturnType<typeof findInvitationProjectById>>;
	submission: Awaited<ReturnType<typeof findSubmissionByRequestId>>;
}

async function resolveTokenContext(token: string): Promise<ResolvedContext> {
	if (!token) throw new ApiError(400, 'bad_request', 'Token is required.');

	const tokenHash = hashIntakeToken(token);
	const intakeRequest = await findIntakeRequestByTokenHash(tokenHash);

	if (!intakeRequest) {
		throw new ApiError(404, 'not_found', 'Enlace no valido o no encontrado.');
	}

	if (intakeRequest.status === 'closed' || intakeRequest.status === 'expired') {
		throw new ApiError(410, 'not_found', 'Este enlace ha expirado o fue cerrado.');
	}

	if (intakeRequest.expiresAt) {
		const expiresAt = new Date(intakeRequest.expiresAt);
		if (expiresAt < new Date()) {
			throw new ApiError(410, 'not_found', 'Este enlace ha expirado.');
		}
	}

	const project = await findInvitationProjectById(intakeRequest.invitationProjectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Proyecto no encontrado.');
	}

	let submission = await findSubmissionByRequestId(intakeRequest.id);
	if (!submission) {
		submission = await createIntakeSubmission({ intakeRequestId: intakeRequest.id });
	}

	return { request: intakeRequest, project, submission };
}

function isProjectLockedForClient(projectStatus: string): boolean {
	return [
		'in_review',
		'in_production',
		'preview_sent',
		'approved',
		'published',
		'archived',
	].includes(projectStatus);
}

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:captura');

		const token = params.token ?? '';
		const ctx = await resolveTokenContext(token);

		return jsonResponse({
			project: {
				id: ctx.project!.id,
				title: ctx.project!.title,
				eventType: ctx.project!.eventType,
				status: ctx.project!.status,
			},
			request: {
				id: ctx.request!.id,
				status: ctx.request!.status,
				enabledBlocks: ctx.request!.enabledBlocks,
			},
			submission: toIntakeSubmissionDTO(ctx.submission!),
		});
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:captura');

		const token = params.token ?? '';
		const ctx = await resolveTokenContext(token);

		if (isProjectLockedForClient(ctx.project!.status)) {
			throw new ApiError(
				403,
				'forbidden',
				'El formulario esta bloqueado. El administrador esta revisando tu captura.',
			);
		}

		const parsed = await validateBodyOrRespond(request, SaveIntakeStepSchema);
		if (parsed instanceof Response) return parsed;

		const updated = await saveSubmissionStep(
			ctx.submission!.id,
			parsed.blockType,
			parsed.blockData,
		);

		return jsonResponse({ item: toIntakeSubmissionDTO(updated) });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:captura');

		const token = params.token ?? '';
		const ctx = await resolveTokenContext(token);

		if (isProjectLockedForClient(ctx.project!.status)) {
			throw new ApiError(
				403,
				'forbidden',
				'El formulario esta bloqueado. El administrador esta revisando tu captura.',
			);
		}

		const parsed = await validateBodyOrRespond(request, SubmitIntakeSchema);
		if (parsed instanceof Response) return parsed;

		const enabledBlocks = ctx.request!.enabledBlocks;
		const blockData = ctx.submission!.blockData ?? {};
		const validationErrors: Array<{ blockType: string; issues: string[] }> = [];

		for (const blockType of enabledBlocks) {
			const data = blockData[blockType];
			const result = validateBlockData(blockType as IntakeBlockType, data ?? {});
			if (!result.success) {
				validationErrors.push({
					blockType,
					issues: result.error.issues.map((i: { message: string }) => i.message),
				});
			}
		}

		if (validationErrors.length > 0) {
			throw new ApiError(422, 'bad_request', 'Uno o mas bloques contienen datos invalidos.', {
				validationErrors,
			});
		}

		const updated = await submitSubmission(ctx.submission!.id, parsed.clientComments);

		await updateIntakeRequest(ctx.request!.id, { status: 'submitted' });
		await updateInvitationProject(ctx.project!.id, { status: 'client_submitted' });

		const baseUrl = getEnv('BASE_URL') || 'https://www.celebra-me.com';
		const reviewUrl = `${baseUrl}/dashboard/invitaciones/${ctx.project!.id}/review`;

		try {
			await sendIntakeNotification({
				projectTitle: ctx.project!.title,
				clientName: ctx.project!.clientName,
				reviewUrl,
			});
		} catch (emailError) {
			console.error(
				'[intake] Failed to send notification email for project:',
				ctx.project!.id,
				emailError,
			);
		}

		return jsonResponse({ item: toIntakeSubmissionDTO(updated) });
	} catch (error) {
		return errorResponse(error);
	}
};
