import React, { useState, useEffect, useRef } from 'react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { generateInvitationLink } from '@/utils/invitation-link';

interface GuestTableProps {
	items: DashboardGuestItem[];
	inviteBaseUrl: string;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
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

const useIsMobile = (breakpoint = 992): boolean => {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth <= breakpoint);
		};

		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, [breakpoint]);

	return isMobile;
};

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	celebratingGuestId,
	highlightedGuestId,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const isMobile = useIsMobile(992);
	const [copiedGuestId, setCopiedGuestId] = useState<string | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (copiedGuestId) {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				setCopiedGuestId(null);
			}, 5000);
		}
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [copiedGuestId]);

	if (!items || items.length === 0) {
		return (
			<div className="dashboard-guests__empty">
				<p>No hay invitados registrados.</p>
			</div>
		);
	}

	const getInviteUrl = (item: DashboardGuestItem) =>
		generateInvitationLink({
			origin: inviteBaseUrl,
			eventType: item.eventType || 'evento',
			eventSlug: item.eventSlug || 'invitacion',
			inviteId: item.inviteId,
			shortId: item.shortId,
		});

	if (isMobile) {
		return (
			<div className="dashboard-guests__cards">
				{items.map((item, index) => (
					<GuestCard
						key={item.guestId}
						item={item}
						index={index}
						inviteUrl={getInviteUrl(item)}
						isCelebrating={celebratingGuestId === item.guestId}
						isHighlighted={highlightedGuestId === item.guestId}
						onEdit={onEdit}
						onDelete={onDelete}
						onMarkShared={onMarkShared}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="dashboard-guests__table-wrap">
			<table className="dashboard-guests__table">
				<thead>
					<tr>
						<th>No.</th>
						<th>Nombre / Contacto</th>
						<th>Categorías</th>
						<th>Estado</th>
						<th>Asistentes</th>
						<th>Envío</th>
						<th>Visto</th>
						<th>Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item, index) => {
						const inviteUrl = getInviteUrl(item);
						const isViewed = !!item.firstViewedAt;
						const isShared = item.deliveryStatus === 'shared';

						return (
							<tr
								key={item.guestId}
								data-guest-id={item.guestId}
								className={`
									${copiedGuestId === item.guestId ? 'row-focus-highlight' : ''}
									${item.deliveryStatus === 'shared' ? 'row-shared' : ''}
									${celebratingGuestId === item.guestId ? 'celebrate-success' : ''}
									${highlightedGuestId === item.guestId ? 'celebrate-success' : ''}
								`.trim()}
							>
								<td data-label="No.">
									<span className="invitation-number">
										#{String(index + 1).padStart(2, '0')}
									</span>
								</td>
								<td data-label="Nombre / Contacto">
									<div className="guest-info">
										<span className="guest-info__name">{item.fullName}</span>
										<span className="guest-info__phone">{item.phone}</span>
										{item.email && (
											<span className="guest-info__email">{item.email}</span>
										)}
									</div>
								</td>
								<td data-label="Categorías">
									<div className="dashboard-guests__tags">
										{(item.tags || []).map((tag) => (
											<span key={tag} className="tag">
												{tag}
											</span>
										))}
									</div>
								</td>
								<td data-label="Estado">
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
								<td data-label="Asistentes">
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
								<td data-label="Envío">
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
								<td data-label="Visto">
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
								<td data-label="Acciones">
									<div className="dashboard-guests__actions">
										<ShareAction
											phone={item.phone}
											waShareUrl={item.waShareUrl}
											inviteUrl={inviteUrl}
											shareText={item.shareText}
											onShared={async () => onMarkShared(item)}
										/>
										<button
											type="button"
											className={`btn-icon ${copiedGuestId === item.guestId ? 'btn-icon--active' : ''}`}
											title="Copiar enlace"
											aria-label={`Copiar enlace de invitación de ${item.fullName}`}
											onClick={async () => {
												await navigator.clipboard.writeText(inviteUrl);
												setCopiedGuestId(item.guestId);
											}}
										>
											{copiedGuestId === item.guestId ? '✅' : '🔗'}
										</button>
										{copiedGuestId === item.guestId && !isShared && (
											<button
												type="button"
												className="btn-accent btn-accent--small animate-pop-in"
												onClick={() => {
													void onMarkShared(item);
													setCopiedGuestId(null);
												}}
											>
												¿Enviado?
											</button>
										)}
										<button
											type="button"
											className="btn-icon"
											title="Editar"
											aria-label={`Editar invitado ${item.fullName}`}
											onClick={() => onEdit(item)}
										>
											✏️
										</button>
										<button
											type="button"
											className="btn-icon btn-icon--danger"
											title="Eliminar"
											aria-label={`Eliminar invitado ${item.fullName}`}
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
