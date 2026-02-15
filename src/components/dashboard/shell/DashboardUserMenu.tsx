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
				<span className="dashboard-user-menu__email">{email || 'sin-email'}</span>
			</div>
			<button
				type="button"
				disabled={busy}
				onClick={async () => {
					setBusy(true);
					await logoutAndRedirect('/');
				}}
			>
				{busy ? 'Saliendo...' : 'Cerrar sesión'}
			</button>
		</div>
	);
};

export default DashboardUserMenu;
