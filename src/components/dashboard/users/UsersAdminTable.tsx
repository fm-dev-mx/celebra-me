import React, { useEffect, useState } from 'react';
import type { AdminUserListItemDTO, AppUserRole } from '@/lib/rsvp-v2/types';

const UsersAdminTable: React.FC = () => {
	const [items, setItems] = useState<AdminUserListItemDTO[]>([]);
	const [error, setError] = useState('');

	const load = async () => {
		const response = await fetch('/api/dashboard/admin/users');
		const data = (await response.json()) as {
			items?: AdminUserListItemDTO[];
			message?: string;
		};
		if (!response.ok) throw new Error(data.message || 'No se pudieron cargar usuarios.');
		setItems(data.items || []);
	};

	useEffect(() => {
		load().catch((err) => {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		});
	}, []);

	return (
		<div className="dashboard-card">
			<h2>Usuarios del Sistema</h2>
			{error && <p className="dashboard-guests__error">{error}</p>}
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
									onChange={async (event) => {
										const role = event.target.value as AppUserRole;
										const response = await fetch(
											`/api/dashboard/admin/users/${encodeURIComponent(item.id)}/role`,
											{
												method: 'PATCH',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({ role }),
											},
										);
										const data = (await response.json()) as {
											message?: string;
										};
										if (!response.ok)
											throw new Error(
												data.message || 'No se pudo actualizar rol.',
											);
										await load();
									}}
								>
									<option value="host_client">HOST</option>
									<option value="super_admin">ADMIN</option>
								</select>
							</td>
							<td>{new Date(item.createdAt).toLocaleString('es-MX')}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default UsersAdminTable;
