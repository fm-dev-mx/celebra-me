import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findInvitationById,
	updateInvitation,
} from '@/lib/intake/repositories/invitation.repository';
import {
	getIntakeRequestsByInvitationId,
	createRequest,
} from '@/lib/intake/services/intake-request.service';
import { CreateIntakeRequestSchema } from '@/lib/intake/schemas/intake-request.schema';
import { toIntakeRequestDTO } from '@/lib/dashboard/dto/intake-mapper';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');

		const requests = await getIntakeRequestsByInvitationId(id, 'client');
		const items = requests.map(toIntakeRequestDTO);

		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'intake:request');

		const { id } = params;
		if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');

		const invitation = await findInvitationById(id);
		if (!invitation) throw new ApiError(404, 'not_found', 'Invitation not found.');

		const parsed = await validateBodyOrRespond(request, CreateIntakeRequestSchema);
		if (parsed instanceof Response) return parsed;

		const result = await createRequest({
			invitationId: id,
			enabledBlocks: parsed.enabledBlocks,
			expiresInDays: parsed.expiresInDays,
		});

		if (invitation.status === 'draft') {
			await updateInvitation(id, { status: 'waiting_for_client' });
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
