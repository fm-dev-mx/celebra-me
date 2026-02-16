import React from 'react';
import WhatsAppInviteButton from './WhatsAppInviteButton';
import { generateInvitationLink } from '@/utils/invitationLink';
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
						const inviteUrl = generateInvitationLink({
							origin: inviteBaseUrl,
							eventType: item.eventType || 'evento',
							eventSlug: item.eventSlug || 'invitacion',
							inviteId: item.inviteId,
							shortId: item.shortId,
						});
						const isViewed = !!item.firstViewedAt;
						const isShared = item.deliveryStatus === 'shared';

						return (
							<tr key={item.guestId} data-guest-id={item.guestId}>
								<td>
									<div className="guest-info">
										<span className="guest-info__name">{item.fullName}</span>
										<span className="guest-info__phone">{item.phoneE164}</span>
										{item.email && (
											<span className="guest-info__email">{item.email}</span>
										)}
									</div>
								</td>
								<td>
									<div className="dashboard-guests__tags">
										{(item.tags || []).map((tag) => (
											<span key={tag} className="tag">
												{tag}
											</span>
										))}
									</div>
								</td>
								<td>
									<div
										className={`status-pill status-pill--${item.attendanceStatus}`}
									>
										<span className="status-pill__dot"></span>
										{item.attendanceStatus === 'pending'
											? 'Pendiente'
											: item.attendanceStatus === 'confirmed'
												? 'Confirmado'
												: 'Declinó'}
									</div>
								</td>
								<td>
									<div className="attendee-count">
										<span className="attendee-count__current">
											{item.attendeeCount}
										</span>
										<span className="attendee-count__separator">/</span>
										<span className="attendee-count__max">
											{item.maxAllowedAttendees}
										</span>
									</div>
								</td>
								<td>
									<div
										className={`delivery-status delivery-status--${item.deliveryStatus}`}
									>
										{isShared ? (
											<span title="Invitación compartida">✅ Enviado</span>
										) : (
											<span title="Pendiente de enviar">⏳ Pendiente</span>
										)}
									</div>
								</td>
								<td>
									<div
										className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}
									>
										{isViewed ? (
											<span
												title={`Visto el ${formatDate(item.firstViewedAt)}`}
											>
												👁️ {formatDate(item.firstViewedAt).split(',')[0]}
											</span>
										) : (
											<span title="No ha sido abierto">🌑 No visto</span>
										)}
									</div>
								</td>
								<td>
									<div className="dashboard-guests__actions">
										<WhatsAppInviteButton
											waShareUrl={item.waShareUrl}
											onShared={async () => onMarkShared(item)}
										/>
										<button
											type="button"
											className="btn-icon"
											title="Copiar Link"
											onClick={async () => {
												await navigator.clipboard.writeText(inviteUrl);
											}}
										>
											🔗
										</button>
										<button
											type="button"
											className="btn-icon"
											title="Abrir invitación"
											onClick={() => window.open(inviteUrl, '_blank')}
										>
											🌍
										</button>
										<button
											type="button"
											className="btn-icon"
											title="Editar"
											onClick={() => onEdit(item)}
										>
											✏️
										</button>
										<button
											type="button"
											className="btn-icon btn-icon--danger"
											title="Eliminar"
											onClick={() => onDelete(item)}
										>
											🗑️
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
