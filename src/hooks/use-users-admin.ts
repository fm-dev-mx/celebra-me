import { useCallback, useEffect, useState } from 'react';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import { adminApi } from '@/lib/dashboard/admin-api';
import type {
	CreateUserDTO,
	CreatedUserCredentialsDTO,
	UpdateUserEventMembershipDTO,
	UserListItemDTO,
} from '@/lib/dashboard/dto/users';
import type { EventListItemDTO } from '@/lib/dashboard/dto/events';

export function useUsersAdmin() {
	const [items, setItems] = useState<UserListItemDTO[]>([]);
	const [events, setEvents] = useState<EventListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [createdUser, setCreatedUser] = useState<CreatedUserCredentialsDTO | null>(null);

	const loadUsers = useCallback(async () => {
		const usersResult = await adminApi.listUsers();
		setItems(usersResult.items);
	}, []);

	const loadEvents = useCallback(async () => {
		const eventsResult = await adminApi.listEvents(1, 200);
		setEvents(eventsResult.items);
	}, []);

	const loadAdminData = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			await Promise.all([loadUsers(), loadEvents()]);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, [loadEvents, loadUsers]);

	useEffect(() => {
		void loadAdminData();
	}, [loadAdminData]);

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

	const openCreateModal = useCallback(() => {
		setError('');
		setCreatedUser(null);
		setCreateModalOpen(true);
	}, []);

	const closeCreateModal = useCallback(() => {
		setError('');
		setCreating(false);
		setCreatedUser(null);
		setCreateModalOpen(false);
	}, []);

	const createUser = useCallback(
		async (payload: CreateUserDTO) => {
			setCreating(true);
			setError('');
			try {
				const result = await adminApi.createUser(payload);
				setCreatedUser({
					email: result.item.email,
					role: result.item.role,
					temporaryPassword: result.credentials.temporaryPassword,
				});
				await loadUsers();
			} catch (err) {
				setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
			} finally {
				setCreating(false);
			}
		},
		[loadUsers],
	);

	const updateUserEventMembership = useCallback(
		async (userId: string, payload: UpdateUserEventMembershipDTO) => {
			setUpdatingUserId(userId);
			setError('');
			try {
				await adminApi.updateUserEventMembership(userId, payload);
				await loadUsers();
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: 'No se pudo actualizar la asignación del evento.',
				);
			} finally {
				setUpdatingUserId(null);
			}
		},
		[loadUsers],
	);

	return {
		items,
		events,
		error,
		loading,
		updatingUserId,
		createModalOpen,
		creating,
		createdUser,
		updateUserRole,
		openCreateModal,
		closeCreateModal,
		createUser,
		updateUserEventMembership,
		reloadUsers: loadAdminData,
	};
}
