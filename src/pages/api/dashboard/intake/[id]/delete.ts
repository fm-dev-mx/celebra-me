import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	mutateInvitationLifecycle,
	type InvitationLifecycleAction,
} from '@/lib/intake/services/invitation-lifecycle.service';
import { createRuntimeMutationCommandContext } from '@/lib/server/runtime-mutation-context';

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:delete');
		const commandContext = await createRuntimeMutationCommandContext(
			session,
			'legacy_dashboard',
		);

		const invitationId = params.id;
		if (!invitationId) {
			throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
		}

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const action = body.action;
		if (!['archive', 'restore', 'permanent_delete'].includes(String(action))) {
			throw new ApiError(
				400,
				'bad_request',
				'Acción no válida. Usa "archive", "restore" o "permanent_delete".',
			);
		}

		return jsonResponse(
			await mutateInvitationLifecycle(
				invitationId,
				action as InvitationLifecycleAction,
				commandContext,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
