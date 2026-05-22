import React from 'react';
import { ChevronDownIcon, MessageIcon } from '@/components/common/icons/ui';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getPrimaryStatusLabel,
	getPrimaryStatusClass,
	getContactDisplay,
	hasContact,
	hasMessage,
	getDeliveryStateLabel,
	getRsvpStateLabel,
	getViewStateLabel,
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
	onRevertShared?: (item: DashboardGuestItem) => Promise<void>;
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
	onRevertShared,
}) => {
	const isShared = item.deliveryStatus === 'shared';
	const visibleTags = getGuestVisibleTags(item);
	const hasTags = visibleTags.length > 0;
	const hasMessageFlag = hasMessage(item);
	const expandId = `guest-details-${item.guestId}`;

	const contactDisplay = getContactDisplay(item);
	const hasAnyContact = hasContact(item);

	return (
		<article
			className={`guest-card ${item.deliveryStatus === 'shared' ? 'guest-card--shared' : ''} ${isCelebrating || isHighlighted ? 'celebrate-success' : ''}`}
			data-guest-id={item.guestId}
		>
			{/* ── Zone 1: Identity + primary status ── */}
			<header className="guest-card__header">
				<div className="guest-card__identity">
					<span className="guest-card__index">#{String(index + 1).padStart(2, '0')}</span>
					<span className="guest-card__name">{item.fullName}</span>
				</div>
				<span className={`status-pill status-pill--${getPrimaryStatusClass(item)}`}>
					<span className="status-pill__dot" />
					{getPrimaryStatusLabel(item)}
				</span>
			</header>

			{/* ── Zone 2: Contact ── */}
			<div
				className={`guest-card__contact${!hasAnyContact ? ' guest-card__contact--fallback' : ''}`}
			>
				{contactDisplay}
			</div>

			{/* ── Zone 3: Metrics ── */}
			<div className="guest-card__metrics">
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Asist.</span>
					<span className="guest-card__stat-value">
						{item.attendeeCount}
						<span className="guest-card__stat-sep">/</span>
						{item.maxAllowedAttendees}
					</span>
				</div>

				<div className={`view-status ${item.isViewed ? 'view-status--viewed' : ''}`}>
					{getViewStateLabel(item)}
				</div>

				{hasMessageFlag && (
					<span className="guest-card__indicator">
						<MessageIcon size={12} /> Tienes 1 mensaje
					</span>
				)}
			</div>

			{/* ── Zone 4: Actions ── */}
			<footer className="guest-card__actions">
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
			</footer>

			{/* ── Zone 5: Expanded panel ── */}
			<section
				id={expandId}
				className={`guest-card__expanded ${isExpanded ? 'guest-card__expanded--open' : ''}`}
				role="region"
				aria-label={`Detalles de ${item.fullName}`}
			>
				<div className="guest-card__expanded-inner">
					{/* Detail grid */}
					<div className="guest-card__expanded-details">
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">Entrega</span>
							<span className="guest-card__detail-value">
								{getDeliveryStateLabel(item)}
							</span>
						</div>
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">RSVP</span>
							<span className="guest-card__detail-value">
								{getRsvpStateLabel(item)}
							</span>
						</div>
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">Visualización</span>
							<span className="guest-card__detail-value">
								{getViewStateLabel(item)}
							</span>
						</div>
						{item.email && (
							<div className="guest-card__detail">
								<span className="guest-card__detail-label">Email</span>
								<span className="guest-card__detail-value">{item.email}</span>
							</div>
						)}
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">Origen</span>
							<span className="guest-card__detail-value">
								{formatGuestEntrySource(item)}
							</span>
						</div>
						{item.firstViewedAt && (
							<div className="guest-card__detail">
								<span className="guest-card__detail-label">Visto</span>
								<span
									className="guest-card__detail-value"
									title={formatGuestDate(item.firstViewedAt)}
								>
									{formatGuestDate(item.firstViewedAt).split(',')[0]}
								</span>
							</div>
						)}
						{item.respondedAt && (
							<div className="guest-card__detail">
								<span className="guest-card__detail-label">Respuesta</span>
								<span
									className="guest-card__detail-value"
									title={formatGuestDate(item.respondedAt)}
								>
									{formatGuestDate(item.respondedAt).split(',')[0]}
								</span>
							</div>
						)}
					</div>

					{/* Guest comment / message */}
					{hasMessageFlag && (
						<div className="guest-card__expanded-message">
							<div className="guest-card__expanded-message-label">
								Mensaje del invitado
							</div>
							<p className="guest-card__expanded-message-text">
								"{item.guestComment}"
							</p>
						</div>
					)}

					{/* Tags */}
					{hasTags && (
						<div className="guest-card__tags">
							{visibleTags.map((tag) => (
								<span key={tag} className="guest-tag">
									{tag}
								</span>
							))}
						</div>
					)}

					{/* Actions */}
					<div className="guest-card__expanded-actions">
						<GuestExpandedActions
							guestName={item.fullName}
							inviteUrl={inviteUrl}
							isShared={isShared}
							attendanceStatus={item.attendanceStatus}
							onEdit={() => onEdit(item)}
							onDelete={() => onDelete(item)}
							onMarkShared={async () => onMarkShared(item)}
							onRevertShared={
								onRevertShared ? async () => onRevertShared(item) : undefined
							}
						/>
					</div>
				</div>
			</section>
		</article>
	);
};

export default GuestCard;
