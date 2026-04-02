import React from 'react';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { useUsersAdmin } from '@/hooks/use-users-admin';
import CreateUserModal from '@/components/dashboard/users/CreateUserModal';

const UsersAdminTable: React.FC = () => {
	const {
		items,
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
	} = useUsersAdmin();

	return (
		<div className="dashboard-card">
			<h2>Usuarios del sistema</h2>
			<div className="dashboard-actions">
				<button type="button" className="btn-primary" onClick={openCreateModal}>
					Crear usuario
				</button>
			</div>
			{error && <p className="dashboard-error">{error}</p>}
			{loading && <p className="dashboard-status">Cargando...</p>}
			<table className="dashboard-table">
				<thead>
					<tr>
						<th>Acceso</th>
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
										void updateUserRole(item.id, role);
									}}
									disabled={loading || updatingUserId === item.id}
									aria-label={`Rol de ${item.email}`}
								>
									<option value="host_client">Anfitrión</option>
									<option value="super_admin">Administrador</option>
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
			{createModalOpen && (
				<CreateUserModal
					busy={creating}
					error={error}
					createdUser={createdUser}
					onClose={closeCreateModal}
					onSubmit={createUser}
				/>
			)}
		</div>
	);
};

const UsersAdminTableWithErrorBoundary: React.FC = () => (
	<ErrorBoundary>
		<UsersAdminTable />
	</ErrorBoundary>
);

export default UsersAdminTableWithErrorBoundary;
