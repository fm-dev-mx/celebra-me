import React, { useEffect, useState, type SyntheticEvent } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import type { UserListItemDTO } from '@/lib/dashboard/dto/users';
import { isValidLoginAlias } from '@/lib/client/auth/login-ui';
import { normalizeHostLoginAlias } from '@/lib/auth/login-alias';

function isManagedAccessDisplay(access: string): boolean {
	return Boolean(access) && !access.includes('@');
}

interface UserCredentialsModalProps {
	user: UserListItemDTO;
	busy: boolean;
	error: string;
	onClose: () => void;
	onSaveLoginAlias: (loginAlias: string) => Promise<boolean>;
	onResetPassword: () => Promise<void>;
}

const UserCredentialsModal: React.FC<UserCredentialsModalProps> = ({
	user,
	busy,
	error,
	onClose,
	onSaveLoginAlias,
	onResetPassword,
}) => {
	const canEditAlias = isManagedAccessDisplay(user.email);
	const [loginAlias, setLoginAlias] = useState(canEditAlias ? user.email : '');
	const [localError, setLocalError] = useState('');
	const [confirmReset, setConfirmReset] = useState(false);

	useEffect(() => {
		setLoginAlias(canEditAlias ? user.email : '');
		setLocalError('');
		setConfirmReset(false);
	}, [canEditAlias, user.email, user.id]);

	const handleSaveAlias = async (event: SyntheticEvent) => {
		event.preventDefault();
		if (busy || !canEditAlias) return;

		const normalized = normalizeHostLoginAlias(loginAlias);
		if (!isValidLoginAlias(loginAlias)) {
			setLocalError(
				'El usuario de acceso debe tener entre 3 y 60 caracteres (letras, números y guion bajo).',
			);
			return;
		}
		setLocalError('');
		await onSaveLoginAlias(normalized);
	};

	const handleResetPassword = async () => {
		if (busy) return;
		if (!confirmReset) {
			setConfirmReset(true);
			return;
		}
		setLocalError('');
		await onResetPassword();
	};

	return (
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				role="dialog"
				aria-modal="true"
				aria-labelledby="user-credentials-title"
				onClick={() => {
					if (!busy) onClose();
				}}
			>
				<div className="dashboard-modal" onClick={(event) => event.stopPropagation()}>
					<h3 id="user-credentials-title">Credenciales de acceso</h3>
					<p className="dashboard-modal__description">
						{canEditAlias
							? 'Actualiza el usuario de acceso o genera una contraseña temporal. El identificador interno del usuario no cambia.'
							: 'Genera una contraseña temporal para este usuario. El identificador interno no cambia.'}
					</p>

					{canEditAlias ? (
						<form onSubmit={handleSaveAlias} className="dashboard-form-grid">
							<div className="dashboard-form-field dashboard-form-field--full">
								<label htmlFor="credentials-login-alias">Usuario de acceso</label>
								<input
									id="credentials-login-alias"
									type="text"
									value={loginAlias}
									onChange={(event) => setLoginAlias(event.target.value)}
									placeholder="abril_becerra"
									autoComplete="username"
									disabled={busy}
								/>
								<p className="dashboard-form-help">
									Alias simple como <code>abril_becerra</code> (sin{' '}
									<code>@</code>). Se usará para iniciar sesión.
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
									Cerrar
								</button>
								<button type="submit" className="btn-primary" disabled={busy}>
									{busy ? 'Guardando...' : 'Guardar usuario'}
								</button>
							</div>
						</form>
					) : (
						<div className="dashboard-form-grid">
							<div className="dashboard-form-field dashboard-form-field--full">
								<label htmlFor="credentials-email-readonly">Correo de acceso</label>
								<input id="credentials-email-readonly" value={user.email} readOnly />
								<p className="dashboard-form-help">
									Este usuario inicia sesión con correo real. El usuario de acceso
									tipo alias solo aplica a cuentas administradas.
								</p>
							</div>
							{error && (
								<p className="dashboard-error dashboard-error--full">{error}</p>
							)}
							<div className="dashboard-modal__actions dashboard-modal__actions--full">
								<button
									type="button"
									className="btn-secondary"
									onClick={onClose}
									disabled={busy}
								>
									Cerrar
								</button>
							</div>
						</div>
					)}

					<hr className="dashboard-modal__divider" />

					<div className="dashboard-form-grid">
						<div className="dashboard-form-field dashboard-form-field--full">
							<p className="dashboard-modal__subtitle">Contraseña</p>
							<p className="dashboard-modal__description">
								{confirmReset
									? `Se generará una contraseña temporal para ${user.email}. La actual se reemplazará y se pedirá una nueva al siguiente inicio de sesión.`
									: 'Restablece la contraseña si el cliente no puede entrar. Se mostrará una temporal una sola vez.'}
							</p>
						</div>
						<div className="dashboard-modal__actions dashboard-modal__actions--full">
							{confirmReset && (
								<button
									type="button"
									className="btn-secondary"
									onClick={() => setConfirmReset(false)}
									disabled={busy}
								>
									Cancelar restablecimiento
								</button>
							)}
							<button
								type="button"
								className="btn-primary"
								onClick={() => {
									void handleResetPassword();
								}}
								disabled={busy}
								aria-label={`Restablecer contraseña de ${user.email}`}
							>
								{busy
									? 'Procesando...'
									: confirmReset
										? 'Sí, restablecer'
										: 'Restablecer contraseña'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default UserCredentialsModal;
