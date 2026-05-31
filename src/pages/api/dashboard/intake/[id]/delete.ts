import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export const POST: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:delete');
		await requireAdminStrongSession(request);

		const projectId = params.id;
		if (!projectId) {
			throw new ApiError(400, 'bad_request', 'Project ID is required.');
		}

		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const action = body.action;

		if (action === 'soft_delete') {
			const result = await supabaseRestRequest<{ soft_delete_invitation_project: boolean }[]>(
				{
					pathWithQuery: `rpc/soft_delete_invitation_project`,
					method: 'POST',
					useServiceRole: true,
					body: { p_project_id: projectId },
					prefer: 'return=representation',
				},
			);

			if (!result?.[0]?.soft_delete_invitation_project) {
				throw new ApiError(404, 'not_found', 'Proyecto no encontrado o ya eliminado.');
			}

			return jsonResponse({ success: true });
		}

		if (action === 'restore') {
			const result = await supabaseRestRequest<{ restore_invitation_project: boolean }[]>({
				pathWithQuery: `rpc/restore_invitation_project`,
				method: 'POST',
				useServiceRole: true,
				body: { p_project_id: projectId },
				prefer: 'return=representation',
			});

			if (!result?.[0]?.restore_invitation_project) {
				throw new ApiError(404, 'not_found', 'Proyecto no encontrado en la papelera.');
			}

			return jsonResponse({ success: true });
		}

		throw new ApiError(400, 'bad_request', 'Acción no válida. Usa "soft_delete" o "restore".');
	} catch (error) {
		return errorResponse(error);
	}
};
