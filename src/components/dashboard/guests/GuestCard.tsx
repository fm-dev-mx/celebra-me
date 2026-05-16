import React, { useState } from 'react';
import { CopyIcon, ChevronDownIcon } from '@/components/common/icons/ui';
import { EditGlyph, DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getGuestAttendanceLabel,
} from '@/components/dashboard/guests/guest-presenter';

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
	const [expanded, setExpanded] = useState(false);
	const isViewed = !!item.firstViewedAt;
	const isShared = item.deliveryStatus === 'shared';
	const hasTags = getGuestVisibleTags(item).length > 0;

	return (
		<article
			className={`guest-card ${item.deliveryStatus === 'shared' ? 'guest-card--shared' : ''} ${isCelebrating || isHighlighted ? 'celebrate-success' : ''}`}
			data-guest-id={item.guestId}
		>
			<div className="guest-card__main">
				<div className="guest-card__header">
					<div className="guest-card__info">
						<span className="guest-card__index">
							#{String(index + 1).padStart(2, '0')}
						</span>
						<span className="guest-card__name">{item.fullName}</span>
					</div>
					<span className={`status-pill status-pill--${item.attendanceStatus}`}>
						<span className="status-pill__dot" />
						{getGuestAttendanceLabel(item.attendanceStatus)}
					</span>
				</div>

				<div className="guest-card__meta">
					{item.phone && <span className="guest-card__contact">{item.phone}</span>}
					{item.email && <span className="guest-card__contact">{item.email}</span>}
				</div>

				<div className="guest-card__status-row">
					<div className="guest-card__stat">
						<span className="guest-card__stat-label">Asist.</span>
						<span className="guest-card__stat-value">
							{item.attendeeCount}
							<span className="guest-card__stat-sep">/</span>
							{item.maxAllowedAttendees}
						</span>
					</div>

					<div className={`delivery-status delivery-status--${item.deliveryStatus}`}>
						{isShared ? 'Entregada' : 'Por enviar'}
					</div>

					<div className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}>
						{isViewed ? (
							<span className="view-status__content">
								<span className="view-status__pct">{item.viewPercentage}%</span>
								<span className="view-status__sep">·</span>
								<span className="view-status__date">
									{formatGuestDate(item.firstViewedAt).split(',')[0]}
								</span>
							</span>
						) : (
							'Sin ver'
						)}
					</div>
				</div>

				{item.guestComment && (
					<div className="guest-card__comment" aria-label="Mensaje del invitado">
						<p className="guest-card__comment-text">"{item.guestComment}"</p>
					</div>
				)}
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
					className="guest-card__menu-btn"
					title="Más opciones"
					aria-label={`Opciones para ${item.fullName}`}
					onClick={() => setExpanded(!expanded)}
				>
					<ChevronDownIcon size={16} />
				</button>
			</div>

			{expanded && (
				<div className="guest-card__expanded">
					<div className="guest-card__tags">
						<span className="guest-tag guest-tag--subtle">
							{formatGuestEntrySource(item)}
						</span>
						{hasTags &&
							getGuestVisibleTags(item).map((tag) => (
								<span key={tag} className="guest-tag">
									{tag}
								</span>
							))}
					</div>

					<div className="guest-card__detail-actions">
						<button
							type="button"
							className="guest-card__action-btn"
							title="Copiar enlace"
							aria-label={`Copiar enlace de ${item.fullName}`}
							onClick={async () => {
								await navigator.clipboard.writeText(inviteUrl);
							}}
						>
							<CopyIcon size={14} />
							<span>Copiar enlace</span>
						</button>
						<button
							type="button"
							className="guest-card__action-btn"
							title="Editar"
							aria-label={`Editar ${item.fullName}`}
							onClick={() => onEdit(item)}
						>
							<EditGlyph size={14} />
							<span>Editar</span>
						</button>
						<button
							type="button"
							className="guest-card__action-btn guest-card__action-btn--danger"
							title="Eliminar"
							aria-label={`Eliminar ${item.fullName}`}
							onClick={() => onDelete(item)}
						>
							<DeleteGlyph size={14} />
							<span>Eliminar</span>
						</button>
					</div>
				</div>
			)}
		</article>
	);
};

export default GuestCard;
