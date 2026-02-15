import React from 'react';
import type { ClaimCodeDTO } from '@/lib/rsvp-v2/types';

interface ClaimCodesTableProps {
	items: ClaimCodeDTO[];
	onDisable: (claimCodeId: string) => Promise<void>;
}

const ClaimCodesTable: React.FC<ClaimCodesTableProps> = ({ items, onDisable }) => {
	return (
		<div className="dashboard-card">
			<table className="dashboard-table">
				<thead>
					<tr>
						<th>ID</th>
						<th>Event</th>
						<th>Estado</th>
						<th>Usos</th>
						<th>Expira</th>
						<th>Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item.id}>
							<td>{item.id}</td>
							<td>{item.eventId}</td>
							<td>
								<span className="dashboard-badge">{item.status}</span>
							</td>
							<td>
								{item.usedCount}/{item.maxUses}
							</td>
							<td>
								{item.expiresAt
									? new Date(item.expiresAt).toLocaleString('es-MX')
									: 'Sin fecha'}
							</td>
							<td>
								<button
									type="button"
									onClick={async () => {
										await onDisable(item.id);
									}}
								>
									Desactivar
								</button>
							</td>
						</tr>
					))}
					{items.length === 0 && (
						<tr>
							<td colSpan={6}>Sin claim codes registrados.</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
};

export default ClaimCodesTable;
