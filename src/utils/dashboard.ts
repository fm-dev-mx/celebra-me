import type { DashboardNavItem } from '@/interfaces/dashboard/admin.interface';

export function isNavItemActive(item: DashboardNavItem, currentPath: string): boolean {
	if (item.href === '/dashboard/invitados' || item.href === '/dashboard/admin') {
		return currentPath === item.href;
	}
	return currentPath.startsWith(`${item.href}/`) || currentPath === item.href;
}
