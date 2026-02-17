import React, { useState } from 'react';
import { logoutAndRedirect } from '@/lib/rsvp-v2/logoutClient';

interface DashboardUserMenuProps {
	email: string;
	roleLabel: 'ADMIN' | 'HOST';
}

const DashboardUserMenu: React.FC<DashboardUserMenuProps> = ({ email, roleLabel }) => {
	const [busy, setBusy] = useState(false);

	return (
		<div className="dashboard-user-menu">
			<div className="dashboard-user-menu__meta">
				<span className="dashboard-user-menu__role">{roleLabel}</span>
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
					await logoutAndRedirect('/');
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
		</div>
	);
};

export default DashboardUserMenu;
