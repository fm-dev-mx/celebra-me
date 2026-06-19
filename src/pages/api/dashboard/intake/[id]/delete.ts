import type { APIRoute } from 'astro';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

const RSVP_HISTORY_MESSAGE =
	'No se puede eliminar definitivamente esta invitación porque tiene actividad RSVP asociada. Puedes mantenerla archivada para conservar el historial.';

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:delete');

		const invitationId = params.id;
		if (!invitationId) {
			throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
		}

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const action = body.action as string;

		const ACTIONS: Record<string, { rpc: string; notFound: string }> = {
			archive: {
				rpc: 'archive_invitation',
				notFound: 'Invitación no encontrada o ya archivada.',
			},
			restore: {
				rpc: 'restore_invitation',
				notFound: 'Invitación no encontrada en archivadas.',
			},
			permanent_delete: {
				rpc: 'permanently_delete_invitation',
				notFound: 'Invitación no encontrada en archivadas.',
			},
		};

		const config = ACTIONS[action];

		if (!config) {
			throw new ApiError(
				400,
				'bad_request',
				'Acción no válida. Usa "archive", "restore" o "permanent_delete".',
			);
		}

		const result = await supabaseRestRequest<unknown>({
			pathWithQuery: `rpc/${config.rpc}`,
			method: 'POST',
			useServiceRole: true,
			body: { p_invitation_id: invitationId },
		});

		if (result === 'blocked_rsvp_history') {
			throw new ApiError(409, 'conflict', RSVP_HISTORY_MESSAGE);
		}

		const isSuccess = action === 'permanent_delete' ? result === 'deleted' : result === true;
		if (!isSuccess) {
			throw new ApiError(404, 'not_found', config.notFound);
		}

		return jsonResponse({ success: true });
	} catch (error) {
		return errorResponse(error);
	}
};
