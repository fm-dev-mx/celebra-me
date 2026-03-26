import React from 'react';
import ShareAction from './ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestCardProps {
	item: DashboardGuestItem;
	index: number;
	inviteUrl: string;
	isCelebrating?: boolean;
	isHighlighted?: boolean;
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

const GuestCard: React.FC<GuestCardProps> = ({
	item,
	index,
	inviteUrl,
	isCelebrating,
	isHighlighted,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const isViewed = !!item.firstViewedAt;
	const isShared = item.deliveryStatus === 'shared';

	return (
		<article
			className={`guest-card ${item.deliveryStatus === 'shared' ? 'guest-card--shared' : ''} ${isCelebrating || isHighlighted ? 'celebrate-success' : ''}`}
			data-guest-id={item.guestId}
		>
			<div className="guest-card__header">
				<div className="guest-card__name">
					<span className="guest-card__number">
						#{String(index + 1).padStart(2, '0')}
					</span>{' '}
					{item.fullName}
				</div>
				<div className={`status-pill status-pill--${item.attendanceStatus}`}>
					<span className="status-pill__dot"></span>
					{item.attendanceStatus === 'pending'
						? 'Pendiente'
						: item.attendanceStatus === 'confirmed'
							? 'Confirmado'
							: 'Declinó'}
				</div>
			</div>

			<div className="guest-card__contact">
				{item.phone && <span className="guest-card__phone">📱 {item.phone}</span>}
				{item.email && <span className="guest-card__email">✉️ {item.email}</span>}
			</div>

			{(item.tags || []).length > 0 && (
				<div className="guest-card__tags">
					{(item.tags || []).map((tag) => (
						<span key={tag} className="tag">
							{tag}
						</span>
					))}
				</div>
			)}

			<div className="guest-card__stats">
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Asistentes</span>
					<span className="attendee-count">
						<span className="attendee-count__current">{item.attendeeCount}</span>
						<span className="attendee-count__separator">/</span>
						<span className="attendee-count__max">{item.maxAllowedAttendees}</span>
					</span>
				</div>
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Estado</span>
					<div className={`delivery-status delivery-status--${item.deliveryStatus}`}>
						{isShared ? <span>✅ Enviado</span> : <span>⏳ Pendiente</span>}
					</div>
				</div>
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Visto</span>
					<div className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}>
						{isViewed ? (
							<span>👁️ {formatDate(item.firstViewedAt).split(',')[0]}</span>
						) : (
							<span>🌑 No visto</span>
						)}
					</div>
				</div>
			</div>

			<div className="guest-card__actions">
				<ShareAction
					phone={item.phone}
					waShareUrl={item.waShareUrl}
					inviteUrl={inviteUrl}
					shareText={item.shareText}
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
		</article>
	);
};

export default GuestCard;
