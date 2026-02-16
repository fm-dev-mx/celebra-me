import React from 'react';
import WhatsAppInviteButton from './WhatsAppInviteButton';
import type { DashboardGuestItem } from './types';

interface GuestTableProps {
	items: DashboardGuestItem[];
	inviteBaseUrl: string;
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

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	if (!items || items.length === 0) {
		return <p className="dashboard-guests__empty">No hay invitados registrados.</p>;
	}

	return (
		<div className="dashboard-guests__table-wrap">
			<table className="dashboard-guests__table">
				<thead>
					<tr>
						<th>Nombre / Contacto</th>
						<th>Categorias</th>
						<th>Estado</th>
						<th>Asistentes</th>
						<th>Envio</th>
						<th>Visto</th>
						<th>Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => {
						const inviteUrl = `${inviteBaseUrl}/invitacion/${encodeURIComponent(item.inviteId)}`;
						return (
							<tr key={item.guestId}>
								<td>
									<strong>{item.fullName}</strong>
									<div>{item.phoneE164}</div>
									{item.email && <div className="text-small">{item.email}</div>}
								</td>
								<td>
									<div className="dashboard-guests__tags">
										{(item.tags || []).map((tag) => (
											<span key={tag} className="tag">
												{tag}
											</span>
										))}
										{(!item.tags || item.tags.length === 0) && (
											<span className="tag-empty">-</span>
										)}
									</div>
								</td>
								<td>
									<span
										className={`status-badge status-${item.attendanceStatus}`}
									>
										{item.attendanceStatus}
									</span>
								</td>
								<td>
									{item.attendeeCount} / {item.maxAllowedAttendees}
								</td>
								<td>{item.deliveryStatus}</td>
								<td>{formatDate(item.firstViewedAt)}</td>
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
