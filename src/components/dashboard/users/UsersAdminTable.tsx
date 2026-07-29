import React, { useState } from 'react';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { useUsersAdmin } from '@/hooks/use-users-admin';
import CreateUserModal from '@/components/dashboard/users/CreateUserModal';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import type { UserListItemDTO } from '@/lib/dashboard/dto/users';

const UsersAdminTable: React.FC = () => {
	const {
		items,
		events,
		error,
		loading,
		updatingUserId,
		createModalOpen,
		creating,
		createdUser,
		updateUserRole,
		updateUserEventMembership,
		openCreateModal,
		closeCreateModal,
		createUser,
		resetUserPassword,
	} = useUsersAdmin();

	const [confirmResetUser, setConfirmResetUser] = useState<UserListItemDTO | null>(null);

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
						<th>Eventos asignados</th>
						<th>Acciones</th>
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
							<td>
								<div className="dashboard-assigned-events">
									<div className="dashboard-assigned-events">
										{item.assignedEvents.map((event) => (
											<span
												key={event.eventId}
												className="dashboard-event-chip"
											>
												{event.title}
												<button
													type="button"
													className="dashboard-event-chip__remove"
													onClick={() => {
														void updateUserEventMembership(item.id, {
															eventId: event.eventId,
															action: 'remove',
														});
													}}
													disabled={loading || updatingUserId === item.id}
													aria-label={`Quitar ${event.title} de ${item.email}`}
												>
													Quitar
												</button>
											</span>
										))}
										{item.assignedEvents.length === 0 && (
											<span>Sin eventos asignados.</span>
										)}
									</div>
									<div className="dashboard-assign-event-row">
										<select
											defaultValue=""
											disabled={loading || updatingUserId === item.id}
											onChange={(event) => {
												const eventId = event.target.value;
												if (!eventId) return;
												void updateUserEventMembership(item.id, {
													eventId,
													action: 'assign',
													membershipRole: 'manager',
												});
												event.currentTarget.value = '';
											}}
											aria-label={`Asignar evento a ${item.email}`}
										>
											<option value="">Asignar evento...</option>
											{events
												.filter(
													(event) =>
														!item.assignedEvents.some(
															(assigned) =>
																assigned.eventId === event.id,
														),
												)
												.map((event) => (
													<option key={event.id} value={event.id}>
														{event.title} ({event.slug})
													</option>
												))}
										</select>
										<small>Se asigna como acceso de tipo manager.</small>
									</div>
								</div>
							</td>
							<td>
								<button
									type="button"
									className="btn-secondary btn--compact"
									onClick={() => setConfirmResetUser(item)}
									disabled={loading || updatingUserId === item.id}
									aria-label={`Restablecer contraseña de ${item.email}`}
								>
									Restablecer contraseña
								</button>
							</td>
							<td>{new Date(item.createdAt).toLocaleString('es-MX')}</td>
						</tr>
					))}
					{items.length === 0 && !loading && (
						<tr>
							<td colSpan={5}>No hay usuarios registrados.</td>
						</tr>
					)}
				</tbody>
			</table>
			{confirmResetUser && (
				<DashboardModalPortal>
					<div
						className="dashboard-modal-backdrop"
						role="dialog"
						aria-modal="true"
						onClick={() => setConfirmResetUser(null)}
					>
						<div
							className="dashboard-modal"
							onClick={(event) => event.stopPropagation()}
						>
							<h3>Restablecer contraseña</h3>
							<p className="dashboard-modal__description">
								¿Deseas restablecer la contraseña de{' '}
								<strong>{confirmResetUser.email}</strong>? Se generará una nueva
								contraseña temporal. La contraseña actual se reemplazará y se le
								solicitará al cliente crear su propia contraseña en su próximo inicio
								de sesión.
							</p>
							<div className="dashboard-modal__actions dashboard-modal__actions--full">
								<button
									type="button"
									className="btn-secondary"
									onClick={() => setConfirmResetUser(null)}
								>
									Cancelar
								</button>
								<button
									type="button"
									className="btn-primary"
									onClick={async () => {
										const userToReset = confirmResetUser;
										setConfirmResetUser(null);
										await resetUserPassword(userToReset.id);
									}}
								>
									Sí, restablecer
								</button>
							</div>
						</div>
					</div>
				</DashboardModalPortal>
			)}
			{(createModalOpen || createdUser) && (
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
