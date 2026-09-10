import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { updateInvitationWorkflowConditionally } from '@/lib/intake/repositories/invitation.repository';
import { canRecordOwnerReview, WorkflowCommandSchema, workflowUpdate } from '@/lib/intake/workflow';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:update');
		const command = await validateBodyOrRespond(request, WorkflowCommandSchema);
		if (command instanceof Response) return command;
		if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id))
			throw new ApiError(400, 'bad_request', 'Identificador inválido.');
		if (command.action !== 'set_work_status' && !canRecordOwnerReview(session.email)) {
			throw new ApiError(
				403,
				'forbidden',
				'Solo el propietario puede registrar o retirar su revisión manual.',
			);
		}
		const updated = await updateInvitationWorkflowConditionally(
			params.id,
			command.expectedUpdatedAt,
			workflowUpdate(command, session.userId, new Date().toISOString()),
		);
		if (!updated)
			throw new ApiError(
				409,
				'conflict',
				'La invitación cambió o ya no está disponible. Recargue la lista.',
			);
		return jsonResponse({ updated: true });
	} catch (error) {
		return errorResponse(error);
	}
};
