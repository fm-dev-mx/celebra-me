import React, { useState } from 'react';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { useUsersAdmin } from '@/hooks/use-users-admin';
import CreateUserModal from '@/components/dashboard/users/CreateUserModal';
import UserCredentialsModal from '@/components/dashboard/users/UserCredentialsModal';
import type { UserListItemDTO } from '@/lib/dashboard/dto/users';
import {
	DEFAULT_ASSIGNED_MEMBERSHIP_ROLE,
	EVENT_MEMBERSHIP_ROLE_HINT,
	EVENT_MEMBERSHIP_ROLE_LABEL,
	type EventMembershipRole,
} from '@/lib/dashboard/membership-role';

const MEMBERSHIP_ROLES = Object.keys(EVENT_MEMBERSHIP_ROLE_LABEL) as EventMembershipRole[];

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
		clearError,
		openCreateModal,
		closeCreateModal,
		createUser,
		resetUserPassword,
		updateUserLoginAlias,
	} = useUsersAdmin();

	const [credentialsUser, setCredentialsUser] = useState<UserListItemDTO | null>(null);
	const [assignRoles, setAssignRoles] = useState<Record<string, EventMembershipRole>>({});
	const assignRoleFor = (userId: string): EventMembershipRole =>
		assignRoles[userId] ?? DEFAULT_ASSIGNED_MEMBERSHIP_ROLE;

	const openCredentials = (user: UserListItemDTO) => {
		clearError();
		setCredentialsUser(user);
	};

	const closeCredentials = () => {
		clearError();
		setCredentialsUser(null);
	};

	return (
		<div className="dashboard-card">
			<h2>Usuarios del sistema</h2>
			<div className="dashboard-actions">
				<button type="button" className="btn-primary" onClick={openCreateModal}>
					Crear usuario
				</button>
			</div>
			{error && !credentialsUser && <p className="dashboard-error">{error}</p>}
			{loading && <p className="dashboard-status">Cargando...</p>}
			<div className="dashboard-table-wrap">
				<table className="dashboard-table dashboard-table--users">
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
										value={item.role ?? ''}
										onChange={(event) => {
											const role = event.target.value as AppUserRole;
											void updateUserRole(item.id, role);
										}}
										disabled={loading || updatingUserId === item.id}
										aria-label={`Rol de ${item.email}`}
									>
										<option value="" disabled>
											Sin rol asignado
										</option>
										<option value="host_client">Anfitrión</option>
										<option value="super_admin">Administrador</option>
									</select>
								</td>
								<td>
									<div className="dashboard-assigned-events">
										{item.assignedEvents.map((event) => (
											<span
												key={event.eventId}
												className="dashboard-event-chip"
											>
												{event.title}
												<select
													className="dashboard-event-chip__role"
													value={event.membershipRole}
													onChange={(change) => {
														void updateUserEventMembership(item.id, {
															eventId: event.eventId,
															action: 'assign',
															membershipRole: change.target
																.value as EventMembershipRole,
														});
													}}
													disabled={loading || updatingUserId === item.id}
													aria-label={`Rol de ${item.email} en ${event.title}`}
												>
													{MEMBERSHIP_ROLES.map((role) => (
														<option key={role} value={role}>
															{EVENT_MEMBERSHIP_ROLE_LABEL[role]}
														</option>
													))}
												</select>
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
											value={assignRoleFor(item.id)}
											onChange={(event) =>
												setAssignRoles((current) => ({
													...current,
													[item.id]: event.target
														.value as EventMembershipRole,
												}))
											}
											disabled={loading || updatingUserId === item.id}
											aria-label={`Rol para el próximo evento de ${item.email}`}
										>
											{MEMBERSHIP_ROLES.map((role) => (
												<option key={role} value={role}>
													{EVENT_MEMBERSHIP_ROLE_LABEL[role]}
												</option>
											))}
										</select>
										<select
											defaultValue=""
											disabled={loading || updatingUserId === item.id}
											onChange={(event) => {
												const eventId = event.target.value;
												if (!eventId) return;
												void updateUserEventMembership(item.id, {
													eventId,
													action: 'assign',
													membershipRole: assignRoleFor(item.id),
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
										<small>{EVENT_MEMBERSHIP_ROLE_HINT}</small>
									</div>
								</td>
								<td>
									<button
										type="button"
										className="btn-secondary btn--compact"
										disabled={loading || updatingUserId === item.id}
										onClick={() => openCredentials(item)}
										aria-label={`Credenciales de ${item.email}`}
									>
										Credenciales
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
			</div>
			{credentialsUser && !createdUser && (
				<UserCredentialsModal
					user={credentialsUser}
					busy={updatingUserId === credentialsUser.id}
					error={error}
					onClose={closeCredentials}
					onSaveLoginAlias={async (loginAlias) => {
						const item = await updateUserLoginAlias(credentialsUser.id, loginAlias);
						if (!item) return false;
						setCredentialsUser(item);
						return true;
					}}
					onResetPassword={async () => {
						const credentials = await resetUserPassword(credentialsUser.id);
						if (!credentials) return;
						closeCredentials();
					}}
				/>
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
