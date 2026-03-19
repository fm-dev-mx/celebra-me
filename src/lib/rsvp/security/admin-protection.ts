/**
 * Protección para el último super_admin
 * Previene que el sistema quede sin administradores
 */

import { listUserRolesService } from '@/lib/rsvp/repositories/role-membership.repository';
import type { AppUserRole } from '@/lib/rsvp/core/types';

/**
 * Verifica si se puede cambiar el rol de un usuario sin dejar
 * al sistema sin super_admins
 *
 * @param targetUserId - ID del usuario cuyo rol se va a cambiar
 * @param newRole - Nuevo rol propuesto
 * @returns true si el cambio es seguro, false si dejaría el sistema sin admins
 */
export async function canChangeUserRole(
	targetUserId: string,
	newRole: AppUserRole,
): Promise<{ allowed: boolean; reason?: string }> {
	// Si el nuevo rol es super_admin, siempre permitir (promoción)
	if (newRole === 'super_admin') {
		return { allowed: true };
	}

	// Obtener todos los roles actuales
	const allRoles = await listUserRolesService();

	// Contar super_admins actuales
	const superAdmins = allRoles.filter((r) => r.role === 'super_admin');
	const superAdminCount = superAdmins.length;

	// Encontrar el rol actual del target
	const targetCurrentRole = allRoles.find((r) => r.userId === targetUserId)?.role;

	// Si el usuario no es super_admin, no hay problema
	if (targetCurrentRole !== 'super_admin') {
		return { allowed: true };
	}

	// Si es super_admin y estamos cambiando a host_client,
	// verificar que quede al menos otro super_admin
	if (superAdminCount <= 1) {
		return {
			allowed: false,
			reason: 'No se puede eliminar el último super_admin del sistema. Por favor, designa otro super_admin primero.',
		};
	}

	return { allowed: true };
}

/**
 * Verifica si hay múltiples super_admins en el sistema
 * Útil para mostrar advertencias en la UI
 */
export async function hasMultipleSuperAdmins(): Promise<boolean> {
	const allRoles = await listUserRolesService();
	const superAdminCount = allRoles.filter((r) => r.role === 'super_admin').length;
	return superAdminCount > 1;
}

/**
 * Obtiene el número actual de super_admins
 */
export async function getSuperAdminCount(): Promise<number> {
	const allRoles = await listUserRolesService();
	return allRoles.filter((r) => r.role === 'super_admin').length;
}
