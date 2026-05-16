import React, { useState } from 'react';
import { logoutAndRedirect } from '@/lib/client/auth/logout-client';

interface DashboardUserMenuProps {
	email: string;
	roleLabel: 'ADMIN' | 'HOST';
}

const INTERNAL_DOMAIN = 'clientes.celebra.invalid';

const DashboardUserMenu: React.FC<DashboardUserMenuProps> = ({ email, roleLabel }) => {
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const displayEmail = email?.replace(new RegExp(`@${INTERNAL_DOMAIN}$`), '') || 'sin-email';

	return (
		<div className="dashboard-sidebar__account">
			<div className="dashboard-sidebar__account-card">
				<span className="dashboard-sidebar__account-label">Panel actual</span>
				<span className="dashboard-sidebar__account-role">
					{roleLabel === 'ADMIN' ? 'Administrador' : 'Anfitrión'}
				</span>
				<span className="dashboard-sidebar__account-email" title={email}>
					{displayEmail}
				</span>
			</div>
			<button
				type="button"
				className="dashboard-sidebar__logout"
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
					<>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							width="14"
							height="14"
							aria-hidden="true"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
							<polyline points="16 17 21 12 16 7" />
							<line x1="21" y1="12" x2="9" y2="12" />
						</svg>
						<span>Cerrar sesión</span>
					</>
				)}
			</button>
			{errorMessage ? (
				<p className="dashboard-sidebar__account-error" role="alert" aria-live="polite">
					{errorMessage}
				</p>
			) : null}
		</div>
	);
};

export default DashboardUserMenu;
