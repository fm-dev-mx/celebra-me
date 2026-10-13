import type { APIRoute } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { InvitationAccessCommandSchema } from '@/lib/invitation/access/invitation-access-command';
import { findInvitationAccessRecord } from '@/lib/invitation/access/invitation-access.repository';
import { setInvitationAccessControl } from '@/lib/invitation/access/invitation-access.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireInvitationId(id: string | undefined): string {
	if (!id || !UUID_PATTERN.test(id)) {
		throw new ApiError(400, 'bad_request', 'Identificador inválido.');
	}
	return id;
}

/** Payment status and public access of one client invitation (administrators only). */
export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);
		const invitationId = requireInvitationId(params.id);
		const item = await findInvitationAccessRecord(invitationId);
		if (!item) throw new ApiError(404, 'not_found', 'La invitación no tiene estado de acceso.');
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};

/** Changes payment status or public access. Hosts never reach this route. */
export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireAdminMutationAccess(request, cookies, 'intake:access');
		const command = await validateBodyOrRespond(request, InvitationAccessCommandSchema);
		if (command instanceof Response) return command;
		const invitationId = requireInvitationId(params.id);
		const item = await setInvitationAccessControl({
			invitationId,
			actorId: session.userId,
			command,
		});
		return jsonResponse({ item });
	} catch (error) {
		return errorResponse(error);
	}
};
