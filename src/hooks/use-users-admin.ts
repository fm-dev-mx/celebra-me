import { useCallback, useEffect, useState } from 'react';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import type { AdminUserListItemDTO } from '@/interfaces/dashboard/admin.interface';
import { adminApi } from '@/lib/dashboard/admin-api';

export function useUsersAdmin() {
	const [items, setItems] = useState<AdminUserListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.listUsers();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const updateUserRole = useCallback(
		async (userId: string, newRole: AppUserRole) => {
			const superAdminCount = items.filter((item) => item.role === 'super_admin').length;
			const currentUser = items.find((item) => item.id === userId);

			if (
				currentUser?.role === 'super_admin' &&
				newRole === 'host_client' &&
				superAdminCount <= 1
			) {
				setError('No se puede eliminar el último administrador del sistema.');
				return;
			}

			setUpdatingUserId(userId);
			setError('');
			try {
				await adminApi.updateUserRole(userId, { role: newRole });
				await loadUsers();
			} catch (err) {
				setError(err instanceof Error ? err.message : 'No se pudo actualizar el rol.');
			} finally {
				setUpdatingUserId(null);
			}
		},
		[items, loadUsers],
	);

	return {
		items,
		error,
		loading,
		updatingUserId,
		updateUserRole,
		reloadUsers: loadUsers,
	};
}
