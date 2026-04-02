import React, { useState, type SyntheticEvent } from 'react';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import type { CreateUserDTO, CreatedUserCredentialsDTO } from '@/lib/dashboard/dto/users';

interface CreateUserModalProps {
	busy: boolean;
	error: string;
	createdUser: CreatedUserCredentialsDTO | null;
	onClose: () => void;
	onSubmit: (payload: CreateUserDTO) => Promise<void>;
}

function toRoleLabel(role: AppUserRole): string {
	return role === 'super_admin' ? 'Administrador' : 'Anfitrión';
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
	busy,
	error,
	createdUser,
	onClose,
	onSubmit,
}) => {
	const [email, setEmail] = useState('');
	const [role, setRole] = useState<AppUserRole>('host_client');
	const [localError, setLocalError] = useState('');

	const handleSubmit = async (event: SyntheticEvent) => {
		event.preventDefault();

		if (busy) {
			return;
		}

		const trimmedEmail = email.trim().toLowerCase();
		setLocalError('');
		await onSubmit({
			email: trimmedEmail,
			role,
		});
	};

	return (
		<div className="dashboard-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
			<div className="dashboard-modal" onClick={(event) => event.stopPropagation()}>
				<h3>{createdUser ? 'Credenciales generadas' : 'Crear usuario'}</h3>
				{createdUser ? (
					<div className="dashboard-form-grid">
						<p className="dashboard-modal__description">
							Entrega estas credenciales al cliente. Si no capturaste un correo real,
							comparte este usuario de acceso tal como aparece aquí. La contraseña se
							muestra solo en este momento.
						</p>
						<div className="dashboard-form-field dashboard-form-field--full">
							<label htmlFor="created-user-email">Usuario de acceso</label>
							<input id="created-user-email" value={createdUser.email} readOnly />
						</div>
						<div className="dashboard-form-field">
							<label htmlFor="created-user-role">Rol</label>
							<input
								id="created-user-role"
								value={toRoleLabel(createdUser.role)}
								readOnly
							/>
						</div>
						<div className="dashboard-form-field dashboard-form-field--full">
							<label htmlFor="created-user-password">Contraseña temporal</label>
							<input
								id="created-user-password"
								value={createdUser.temporaryPassword}
								readOnly
								aria-label="Contraseña temporal"
							/>
							<p className="dashboard-form-help">
								Esta contraseña no se volverá a mostrar después de cerrar este
								modal.
							</p>
						</div>
						<div className="dashboard-modal__actions dashboard-modal__actions--full">
							<button type="button" className="btn-primary" onClick={onClose}>
								Entendido
							</button>
						</div>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="dashboard-form-grid">
						<div className="dashboard-form-field dashboard-form-field--full">
							<label htmlFor="user-email">
								Correo electrónico o usuario (opcional)
							</label>
							<input
								id="user-email"
								type="text"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder="cliente@ejemplo.com o ximena_meza"
								autoComplete="username"
								disabled={busy}
							/>
							<p className="dashboard-form-help">
								Puedes capturar un correo real, un alias simple como{' '}
								<code>ximena_meza</code>, o dejarlo vacío. Si no incluyes
								<code>@</code>, ese valor se usará como usuario de acceso; si lo
								dejas vacío, generaremos uno por ti.
							</p>
						</div>
						<div className="dashboard-form-field dashboard-form-field--full">
							<label htmlFor="user-role">Rol</label>
							<select
								id="user-role"
								value={role}
								onChange={(event) => setRole(event.target.value as AppUserRole)}
								disabled={busy}
							>
								<option value="host_client">Anfitrión</option>
								<option value="super_admin">Administrador</option>
							</select>
							<p className="dashboard-form-help">
								Los administradores creados por esta vía deberán completar MFA al
								iniciar sesión.
							</p>
						</div>
						{(localError || error) && (
							<p className="dashboard-error dashboard-error--full">
								{localError || error}
							</p>
						)}
						<div className="dashboard-modal__actions dashboard-modal__actions--full">
							<button
								type="button"
								className="btn-secondary"
								onClick={onClose}
								disabled={busy}
							>
								Cancelar
							</button>
							<button type="submit" className="btn-primary" disabled={busy}>
								{busy ? 'Creando...' : 'Crear usuario'}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
};

export default CreateUserModal;
