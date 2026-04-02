import React from 'react';
import { CopyIcon } from '@/components/common/icons/ui';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getGuestAttendanceLabel,
} from '@/components/dashboard/guests/guest-presenter';
import { MessageIcon } from '@/components/common/icons/ui';

const EditGlyph = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
);

const DeleteGlyph = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M3 6h18" />
		<path d="M8 6V4h8v2" />
		<path d="M19 6l-1 14H6L5 6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
	</svg>
);

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
					{getGuestAttendanceLabel(item.attendanceStatus)}
				</div>
			</div>

			<div className="guest-card__contact">
				{item.phone && <span className="guest-card__phone">Tel. {item.phone}</span>}
				{item.email && <span className="guest-card__email">{item.email}</span>}
				<span className="tag">{formatGuestEntrySource(item)}</span>
			</div>

			{getGuestVisibleTags(item).length > 0 && (
				<div className="guest-card__tags">
					{getGuestVisibleTags(item).map((tag) => (
						<span key={tag} className="tag">
							{tag}
						</span>
					))}
				</div>
			)}

			{item.guestComment && (
				<div className="guest-card__comment animate-pop-in">
					<div className="guest-card__comment-label">
						<MessageIcon size={16} />
						<span>Nota del Invitado</span>
					</div>
					<p className="guest-card__comment-text">{item.guestComment}</p>
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
						{isShared ? <span>Entregada</span> : <span>Por enviar</span>}
					</div>
				</div>
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Visto</span>
					<div className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}>
						{isViewed ? (
							<span>{formatGuestDate(item.firstViewedAt).split(',')[0]}</span>
						) : (
							<span>Sin apertura</span>
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
					title="Copiar enlace"
					aria-label={`Copiar enlace de invitación de ${item.fullName}`}
					onClick={async () => {
						await navigator.clipboard.writeText(inviteUrl);
					}}
				>
					<CopyIcon size={16} />
				</button>
				<button
					type="button"
					className="btn-icon"
					title="Editar"
					aria-label={`Editar invitado ${item.fullName}`}
					onClick={() => onEdit(item)}
				>
					<EditGlyph />
				</button>
				<button
					type="button"
					className="btn-icon btn-icon--danger"
					title="Eliminar"
					aria-label={`Eliminar invitado ${item.fullName}`}
					onClick={() => onDelete(item)}
				>
					<DeleteGlyph />
				</button>
			</div>
		</article>
	);
};

export default GuestCard;
