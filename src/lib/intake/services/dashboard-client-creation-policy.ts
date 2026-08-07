import { ApiError } from '@/lib/rsvp/core/errors';

/**
 * Dashboard HTTP create/duplicate must not create managed (or any) client invitations.
 * Legitimate creates remain: managed `invitation:release` / import engines, demo sync,
 * repository/service callers in provision & tests.
 */
export function rejectDashboardClientInvitationCreation(details?: {
	via: 'create' | 'duplicate';
}): never {
	throw new ApiError(
		403,
		'forbidden',
		'Las invitaciones de cliente se crean solo con el flujo administrado (definición en scripts/provision/invitations y pnpm invitation:release).',
		{
			reason: 'canonical_creation_required',
			via: details?.via ?? 'create',
			workflow: 'invitation-production',
		},
	);
}
