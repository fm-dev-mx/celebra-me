import React from 'react';
import { ChevronDownIcon } from '@/components/common/icons/ui';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getGuestStatusLabel,
	getGuestStatusClass,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestCardProps {
	item: DashboardGuestItem;
	index: number;
	inviteUrl: string;
	isCelebrating?: boolean;
	isHighlighted?: boolean;
	isExpanded?: boolean;
	onToggleExpanded?: () => void;
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
	isExpanded,
	onToggleExpanded,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const isViewed = !!item.firstViewedAt;
	const isShared = item.deliveryStatus === 'shared';
	const visibleTags = getGuestVisibleTags(item);
	const hasTags = visibleTags.length > 0;
	const expandId = `guest-details-${item.guestId}`;

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
					<span className={`status-pill status-pill--${getGuestStatusClass(item)}`}>
						<span className="status-pill__dot" />
						{getGuestStatusLabel(item)}
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
			</div>

			<div className="guest-card__actions">
				<ShareAction
					phone={item.phone}
					waShareUrl={item.waShareUrl}
					inviteUrl={inviteUrl}
					shareText={item.shareText}
					isShared={isShared}
					onShared={async () => onMarkShared(item)}
				/>
				<button
					type="button"
					className={`guest-card__menu-btn ${isExpanded ? 'guest-card__menu-btn--open' : ''}`}
					title={isExpanded ? 'Ver menos detalles' : 'Ver más detalles'}
					aria-label={
						isExpanded
							? `Ver menos detalles de ${item.fullName}`
							: `Ver más detalles de ${item.fullName}`
					}
					aria-expanded={isExpanded}
					aria-controls={expandId}
					onClick={onToggleExpanded}
				>
					<ChevronDownIcon size={16} aria-hidden="true" />
				</button>
			</div>

			<div
				id={expandId}
				className={`guest-card__expanded ${isExpanded ? 'guest-card__expanded--open' : ''}`}
				role="region"
				aria-label={`Detalles de ${item.fullName}`}
			>
				<div className="guest-card__expanded-inner">
					{item.guestComment && (
						<div className="guest-card__comment" aria-label="Mensaje del invitado">
							<p className="guest-card__comment-text">"{item.guestComment}"</p>
						</div>
					)}

					<div className="guest-card__tags">
						<span className="guest-tag guest-tag--subtle">
							{formatGuestEntrySource(item)}
						</span>
						{hasTags &&
							visibleTags.map((tag) => (
								<span key={tag} className="guest-tag">
									{tag}
								</span>
							))}
					</div>

					<div className="guest-card__expanded-actions">
						<GuestExpandedActions
							guestName={item.fullName}
							inviteUrl={inviteUrl}
							isShared={isShared}
							onEdit={() => onEdit(item)}
							onDelete={() => onDelete(item)}
							onMarkShared={async () => onMarkShared(item)}
						/>
					</div>
				</div>
			</div>
		</article>
	);
};

export default GuestCard;
