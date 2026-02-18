import React, { useEffect, useState } from 'react';
import type { AdminUserListItemDTO, AppUserRole } from '@/lib/rsvp-v2/types';
import { adminApi } from '@/lib/dashboard/adminApi';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';

const UsersAdminTable: React.FC = () => {
	const [items, setItems] = useState<AdminUserListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const load = async () => {
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
	};

	useEffect(() => {
		void load();
	}, []);

	const handleRoleChange = async (userId: string, newRole: AppUserRole) => {
		try {
			// Check if this is the last super_admin
			const superAdminCount = items.filter((item) => item.role === 'super_admin').length;
			const currentUser = items.find((item) => item.id === userId);

			if (
				currentUser?.role === 'super_admin' &&
				newRole === 'host_client' &&
				superAdminCount <= 1
			) {
				alert('No se puede eliminar el último super_admin del sistema.');
				return;
			}

			await adminApi.updateUserRole(userId, { role: newRole });
			await load();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'No se pudo actualizar rol.');
		}
	};

	return (
		<div className="dashboard-card">
			<h2>Usuarios del Sistema</h2>
			{error && <p className="dashboard-error">{error}</p>}
			{loading && <p className="dashboard-status">Cargando...</p>}
			<table className="dashboard-table">
				<thead>
					<tr>
						<th>Email</th>
						<th>Rol</th>
						<th>Creado</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id}>
							<td>{item.email}</td>
							<td>
								<select
									value={item.role}
									onChange={(event) => {
										const role = event.target.value as AppUserRole;
										void handleRoleChange(item.id, role);
									}}
									disabled={loading}
								>
									<option value="host_client">HOST</option>
									<option value="super_admin">ADMIN</option>
								</select>
							</td>
							<td>{new Date(item.createdAt).toLocaleString('es-MX')}</td>
						</tr>
					))}
					{items.length === 0 && !loading && (
						<tr>
							<td colSpan={3}>No hay usuarios registrados.</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
};

const UsersAdminTableWithErrorBoundary: React.FC = () => (
	<ErrorBoundary>
		<UsersAdminTable />
	</ErrorBoundary>
);

export default UsersAdminTableWithErrorBoundary;
