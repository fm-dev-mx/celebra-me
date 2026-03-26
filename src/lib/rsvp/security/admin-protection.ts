/**
 * Protects the final remaining super admin account.
 */

import { listUserRolesService } from '@/lib/rsvp/repositories/role-membership.repository';
import type { AppUserRole } from '@/interfaces/auth/session.interface';

/**
 * Verifies that changing a user's role will not leave the system without a super admin.
 */
export async function canChangeUserRole(
	targetUserId: string,
	newRole: AppUserRole,
): Promise<{ allowed: boolean; reason?: string }> {
	// Promotions to super_admin are always safe.
	if (newRole === 'super_admin') {
		return { allowed: true };
	}

	// Load the current role assignments.
	const allRoles = await listUserRolesService();

	// Count active super admins.
	const superAdmins = allRoles.filter((r) => r.role === 'super_admin');
	const superAdminCount = superAdmins.length;

	// Resolve the current role for the target user.
	const targetCurrentRole = allRoles.find((r) => r.userId === targetUserId)?.role;

	// No risk if the target user is not currently a super admin.
	if (targetCurrentRole !== 'super_admin') {
		return { allowed: true };
	}

	// Demoting the final super admin would lock the system out of global admin access.
	if (superAdminCount <= 1) {
		return {
			allowed: false,
			reason:
				'The final super_admin cannot be removed. Assign another super_admin first.',
		};
	}

	return { allowed: true };
}

/**
 * Returns true when the system currently has more than one super admin.
 */
export async function hasMultipleSuperAdmins(): Promise<boolean> {
	const allRoles = await listUserRolesService();
	const superAdminCount = allRoles.filter((r) => r.role === 'super_admin').length;
	return superAdminCount > 1;
}

/**
 * Returns the current number of super admins.
 */
export async function getSuperAdminCount(): Promise<number> {
	const allRoles = await listUserRolesService();
	return allRoles.filter((r) => r.role === 'super_admin').length;
}
