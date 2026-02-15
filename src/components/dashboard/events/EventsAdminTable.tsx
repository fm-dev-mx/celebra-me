import React, { useEffect, useState } from 'react';
import type { AdminEventListItemDTO } from '@/lib/rsvp-v2/types';

const EventsAdminTable: React.FC = () => {
	const [items, setItems] = useState<AdminEventListItemDTO[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		(async () => {
			try {
				const response = await fetch('/api/dashboard/admin/events');
				const data = (await response.json()) as {
					items?: AdminEventListItemDTO[];
					message?: string;
				};
				if (!response.ok) throw new Error(data.message || 'No se pudieron cargar eventos.');
				setItems(data.items || []);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Error inesperado.');
			}
		})();
	}, []);

	return (
		<div className="dashboard-card">
			<h2>Eventos Globales</h2>
			{error && <p className="dashboard-guests__error">{error}</p>}
			<table className="dashboard-table">
				<thead>
					<tr>
						<th>Título</th>
						<th>Slug</th>
						<th>Tipo</th>
						<th>Estado</th>
						<th>Owner</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id}>
							<td>{item.title}</td>
							<td>{item.slug}</td>
							<td>{item.eventType}</td>
							<td>{item.status}</td>
							<td>{item.ownerUserId}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default EventsAdminTable;
