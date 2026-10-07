import type { AstroCookies } from 'astro';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';

export function requireInvitationId(id: string | undefined): string {
	if (!id) throw new ApiError(400, 'bad_request', 'Invitation ID is required.');
	return id;
}

export async function requireEditorReadAccess(request: Request): Promise<void> {
	await requireAdminRateLimit(request, 'intake:draft');
	await requireAdminStrongSession(request);
}

export async function requireEditorMutationAccess(
	request: Request,
	cookies: AstroCookies,
): Promise<SessionContext> {
	return requireAdminMutationAccess(request, cookies, 'intake:draft');
}
