import type { AppUserRole } from '@/interfaces/auth/session.interface';
import { getAuthUserAdminById } from '@/lib/rsvp/auth/auth-api';
import { normalizeAppRole } from '@/lib/rsvp/auth/roles';
import { ApiError } from '@/lib/rsvp/core/errors';

export function assertAccountAccess(role: AppUserRole | null, authRole: unknown): void {
	if (!role || normalizeAppRole(authRole) !== role) {
		throw new ApiError(
			409,
			'account_access_incomplete',
			'El acceso de la cuenta está incompleto. Asigne un rol y verifique su sincronización antes de continuar.',
		);
	}
}

export async function verifyUserRoleSynchronization(
	userId: string,
	role: AppUserRole,
): Promise<void> {
	const user = await getAuthUserAdminById(userId);
	assertAccountAccess(role, user.app_metadata?.role);
}
