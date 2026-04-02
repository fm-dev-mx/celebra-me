import React, { useState } from 'react';
import { logoutAndRedirect } from '@/lib/client/auth/logout-client';

interface DashboardUserMenuProps {
	email: string;
	roleLabel: 'ADMIN' | 'HOST';
}

const DashboardUserMenu: React.FC<DashboardUserMenuProps> = ({ email, roleLabel }) => {
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const visibleRoleLabel = roleLabel === 'ADMIN' ? 'Administrador' : 'Anfitrión';

	return (
		<div className="dashboard-user-menu">
			<div className="dashboard-user-menu__meta">
				<span className="dashboard-user-menu__role">{visibleRoleLabel}</span>
				<span className="dashboard-user-menu__email" title={email}>
					{email
						? email.length > 15
							? email.substring(0, 12) + '...'
							: email
						: 'sin-email'}
				</span>
			</div>
			<button
				type="button"
				className="btn-pill-logout"
				disabled={busy}
				onClick={async () => {
					setBusy(true);
					setErrorMessage('');
					try {
						await logoutAndRedirect('/login');
					} catch {
						setErrorMessage('No se pudo cerrar la sesión. Inténtalo de nuevo.');
						setBusy(false);
					}
				}}
			>
				{busy ? (
					<span className="busy-loader">
						<span className="dot"></span>
						<span className="dot"></span>
						<span className="dot"></span>
					</span>
				) : (
					<span className="btn-text">Cerrar sesión</span>
				)}
			</button>
			{errorMessage ? (
				<p className="dashboard-user-menu__error" role="alert" aria-live="polite">
					{errorMessage}
				</p>
			) : null}
		</div>
	);
};

export default DashboardUserMenu;
