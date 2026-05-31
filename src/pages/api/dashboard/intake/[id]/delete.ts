import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';

const RSVP_HISTORY_MESSAGE =
	'No se puede eliminar definitivamente esta invitación porque tiene actividad RSVP asociada. Puedes mantenerla archivada para conservar el historial.';

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'intake:delete');
		await requireAdminStrongSession(request);

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		const invitationId = params.id;
		if (!invitationId) {
			throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
		}

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const action = body.action;

		if (action === 'archive') {
			const result = await supabaseRestRequest<boolean>({
				pathWithQuery: 'rpc/archive_invitation',
				method: 'POST',
				useServiceRole: true,
				body: { p_invitation_id: invitationId },
			});

			if (!result) {
				throw new ApiError(404, 'not_found', 'Invitación no encontrada o ya archivada.');
			}

			return jsonResponse({ success: true });
		}

		if (action === 'restore') {
			const result = await supabaseRestRequest<boolean>({
				pathWithQuery: 'rpc/restore_invitation',
				method: 'POST',
				useServiceRole: true,
				body: { p_invitation_id: invitationId },
			});

			if (!result) {
				throw new ApiError(404, 'not_found', 'Invitación no encontrada en archivadas.');
			}

			return jsonResponse({ success: true });
		}

		if (action === 'permanent_delete') {
			const result = await supabaseRestRequest<string>({
				pathWithQuery: 'rpc/permanently_delete_invitation',
				method: 'POST',
				useServiceRole: true,
				body: { p_invitation_id: invitationId },
			});

			if (result === 'blocked_rsvp_history') {
				throw new ApiError(409, 'conflict', RSVP_HISTORY_MESSAGE);
			}
			if (result !== 'deleted') {
				throw new ApiError(404, 'not_found', 'Invitación no encontrada en archivadas.');
			}

			return jsonResponse({ success: true });
		}

		throw new ApiError(
			400,
			'bad_request',
			'Acción no válida. Usa "archive", "restore" o "permanent_delete".',
		);
	} catch (error) {
		return errorResponse(error);
	}
};
