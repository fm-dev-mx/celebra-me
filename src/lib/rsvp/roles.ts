import type { AppUserRole } from './types';

export type UiRole = 'ADMIN' | 'HOST';

export function normalizeAppRole(rawRole: unknown): AppUserRole | null {
	if (rawRole === 'super_admin' || rawRole === 'host_client') return rawRole;
	return null;
}

export function isSuperAdminRole(role: AppUserRole | null | undefined): boolean {
	return role === 'super_admin';
}

export function toDisplayRole(role: AppUserRole | null | undefined): UiRole {
	return role === 'super_admin' ? 'ADMIN' : 'HOST';
}

export function resolveDashboardHome(role: AppUserRole | null | undefined): string {
	return role === 'super_admin' ? '/dashboard/admin' : '/dashboard/invitados';
}
