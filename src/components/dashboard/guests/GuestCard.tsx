import React, { useState } from 'react';
import { ChevronDownIcon, MessageIcon } from '@/components/common/icons/ui';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestVisibleTags,
	getPrimaryStatus,
	getContactDisplay,
	hasContact,
	hasMessage,
	getDeliveryStateLabel,
	getRsvpStateLabel,
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
	isBrandingRemovalEligible?: boolean;
	onToggleBrandingRemoval?: (guestId: string, hideCelebraMeBranding: boolean) => void;
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
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
}) => {
	const [messageVisible, setMessageVisible] = useState(false);
	const isShared = item.deliveryStatus === 'shared';
	const visibleTags = getGuestVisibleTags(item);
	const hasTags = visibleTags.length > 0;
	const hasMessageFlag = hasMessage(item);
	const expandId = `guest-details-${item.guestId}`;

	const viewPercentage = Number.isFinite(item.viewPercentage)
		? Math.min(100, Math.max(0, Math.round(item.viewPercentage)))
		: 0;

	const contactDisplay = getContactDisplay(item);
	const hasAnyContact = hasContact(item);
	const brandingBadge = item.hideCelebraMeBranding && (
		<span className="guest-card__branding-badge">Sin marca</span>
	);
	const expandLabel = isExpanded
		? `Ver menos detalles de ${item.fullName}`
		: `Ver más detalles de ${item.fullName}`;
	const compactViewLabel = `Vista: ${viewPercentage}%`;
	const messageLabel = messageVisible ? 'Ocultar mensaje' : 'Mensaje del invitado';
	const articleClass = [
		'guest-card',
		item.deliveryStatus === 'shared' ? 'guest-card--shared' : '',
		isCelebrating || isHighlighted ? 'celebrate-success' : '',
	]
		.filter(Boolean)
		.join(' ');

	const messageToggle = hasMessageFlag && (
		<button
			type="button"
			className={`guest-card__msg-toggle ${messageVisible ? 'guest-card__msg-toggle--open' : ''}`}
			onClick={() => setMessageVisible((v) => !v)}
			aria-expanded={messageVisible}
		>
			<MessageIcon size={16} aria-hidden="true" />
			<span>{messageLabel}</span>
		</button>
	);

	const messageBlock = hasMessageFlag && (
		<div
			className={`guest-card__message-block ${messageVisible ? 'guest-card__message-block--open' : ''}`}
		>
			<div className="guest-card__message-inner">
				<span className="guest-card__message-label">Mensaje del invitado</span>
				<p className="guest-card__message-text">{item.guestComment}</p>
			</div>
		</div>
	);

	const renderExpandedPanel = () => (
		<section
			id={expandId}
			className={`guest-card__expanded ${isExpanded ? 'guest-card__expanded--open' : ''}`}
			role="region"
			aria-label={`Detalles de ${item.fullName}`}
		>
			<div className="guest-card__expanded-inner">
				<div className="guest-card__expanded-details">
					<div className="guest-card__detail">
						<span className="guest-card__detail-label">Entrega</span>
						<span className="guest-card__detail-value">
							{getDeliveryStateLabel(item)}
						</span>
					</div>
					<div className="guest-card__detail">
						<span className="guest-card__detail-label">RSVP</span>
						<span className="guest-card__detail-value">{getRsvpStateLabel(item)}</span>
					</div>
					<div className="guest-card__detail guest-card__detail--view-progress">
						<span className="guest-card__detail-label">Visualización</span>
						<span className="guest-card__detail-value engagement-mini-wrap">
							<progress
								className="engagement-mini"
								value={viewPercentage}
								max={100}
								role="progressbar"
								aria-valuenow={viewPercentage}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`Visualización: ${viewPercentage}%`}
							/>
							<span className="engagement-mini__label">{viewPercentage}%</span>
						</span>
					</div>
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
				{hasTags && (
					<div className="guest-card__tags">
						{visibleTags.map((tag) => (
							<span key={tag} className="guest-tag">
								{tag}
							</span>
						))}
					</div>
				)}
				<div className="guest-card__expanded-actions">
					<GuestExpandedActions
						guestName={item.fullName}
						inviteUrl={inviteUrl}
						isShared={isShared}
						onEdit={() => onEdit(item)}
						onDelete={() => onDelete(item)}
						onMarkShared={async () => onMarkShared(item)}
						onRevertShared={
							onRevertShared ? async () => onRevertShared(item) : undefined
						}
						guestId={item.guestId}
						hideCelebraMeBranding={item.hideCelebraMeBranding ?? false}
						isBrandingRemovalEligible={isBrandingRemovalEligible}
						onToggleBrandingRemoval={onToggleBrandingRemoval}
					/>
				</div>
			</div>
		</section>
	);

	return (
		<article className={articleClass} data-guest-id={item.guestId}>
			<header className="guest-card__header">
				<div className="guest-card__identity">
					<span className="guest-card__index">#{String(index + 1).padStart(2, '0')}</span>
					<span className="guest-card__name">{item.fullName}</span>
					{brandingBadge}
				</div>
				<span className={`status-pill status-pill--${getPrimaryStatus(item).class}`}>
					<span className="status-pill__dot" />
					{getPrimaryStatus(item).label}
				</span>
			</header>

			<div
				className={`guest-card__contact${!hasAnyContact ? ' guest-card__contact--fallback' : ''}`}
			>
				{contactDisplay}
			</div>

			<div className="guest-card__metrics">
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Asistentes:</span>
					<span className="guest-card__stat-value">
						{item.attendeeCount}
						<span className="guest-card__stat-sep">/</span>
						{item.maxAllowedAttendees}
					</span>
				</div>
				<span className="view-status view-status--bare">{compactViewLabel}</span>
				{messageToggle}
			</div>

			{messageBlock}

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
					title={expandLabel}
					aria-label={expandLabel}
					aria-expanded={isExpanded}
					aria-controls={expandId}
					onClick={onToggleExpanded}
				>
					<ChevronDownIcon size={16} aria-hidden="true" />
				</button>
			</footer>

			{renderExpandedPanel()}
		</article>
	);
};

export default GuestCard;
