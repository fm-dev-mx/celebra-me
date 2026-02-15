import React from 'react';
import WhatsAppInviteButton from './WhatsAppInviteButton';
import type { DashboardGuestItem } from './types';

interface GuestTableProps {
	items: DashboardGuestItem[];
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
}

function formatDate(value: string | null): string {
	if (!value) return '-';
	try {
		return new Date(value).toLocaleString('es-MX');
	} catch {
		return value;
	}
}

const GuestTable: React.FC<GuestTableProps> = ({ items, onEdit, onDelete, onMarkShared }) => {
	if (items.length === 0) {
		return <p className="dashboard-guests__empty">No hay invitados registrados.</p>;
	}

	return (
		<div className="dashboard-guests__table-wrap">
			<table className="dashboard-guests__table">
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Estado</th>
						<th>Asistentes</th>
						<th>Envio</th>
						<th>Visto</th>
						<th>Mensaje</th>
						<th>Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => {
						const inviteUrl = `${window.location.origin}/invitacion/${encodeURIComponent(item.inviteId)}`;
						return (
							<tr key={item.guestId}>
								<td>
									<strong>{item.fullName}</strong>
									<div>{item.phoneE164}</div>
								</td>
								<td>{item.attendanceStatus}</td>
								<td>
									{item.attendeeCount} / {item.maxAllowedAttendees}
								</td>
								<td>{item.deliveryStatus}</td>
								<td>{formatDate(item.firstViewedAt)}</td>
								<td>{item.guestMessage || '-'}</td>
								<td>
									<div className="dashboard-guests__actions">
										<button type="button" onClick={() => onEdit(item)}>
											Editar
										</button>
										<button
											type="button"
											onClick={async () => {
												await navigator.clipboard.writeText(inviteUrl);
											}}
										>
											Copiar link
										</button>
										<WhatsAppInviteButton
											waShareUrl={item.waShareUrl}
											onShared={async () => onMarkShared(item)}
										/>
										<button
											type="button"
											onClick={() => window.open(inviteUrl, '_blank')}
										>
											Abrir
										</button>
										<button type="button" onClick={() => onDelete(item)}>
											Eliminar
										</button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

export default GuestTable;
