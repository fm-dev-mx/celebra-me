import React from 'react';
import { ChevronDownIcon } from '@/components/common/icons/ui';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getCompactGroupChips,
	getPrimaryStatus,
	hasMessage,
	getDeliveryStateLabel,
	getRsvpStateLabel,
	normalizeViewPercentage,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestCardProps {
	item: DashboardGuestItem;
	index: number;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
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
	onSaveGuest?: GuestSaveCallback;
}

const GuestCard: React.FC<GuestCardProps> = ({
	item,
	index,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
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
	onSaveGuest,
}) => {
	const isShared = item.deliveryStatus === 'shared';

	const visibleTags = getVisibleTags(item.tags);
	const hasTags = visibleTags.length > 0;
	const { chips: compactChips, overflow: compactOverflow } = getCompactGroupChips(item, 1);
	const hasCompactChips = compactChips.length > 0;
	const hasMsg = hasMessage(item);
	const primaryStatus = getPrimaryStatus(item);
	const expandId = `guest-details-${item.guestId}`;

	const viewPercentage = normalizeViewPercentage(item.viewPercentage);

	const expandLabel = isExpanded
		? `Ver menos detalles de ${item.fullName}`
		: `Ver más detalles de ${item.fullName}`;
	const articleClass = [
		'guest-card',
		isShared ? 'guest-card--shared' : '',
		isCelebrating || isHighlighted ? 'celebrate-success' : '',
	]
		.filter(Boolean)
		.join(' ');

	const renderExpandedPanel = () => (
		<section
			id={expandId}
			className={`guest-card__expanded ${isExpanded ? 'guest-card__expanded--open' : ''}`}
			role="region"
			aria-label={`Detalles de ${item.fullName}`}
		>
			<div className="guest-card__expanded-inner">
				{/* Zone A: Status / Activity */}
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
					<div className="guest-card__detail">
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
					{hasTags && (
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">Categoría</span>
							<div className="guest-card__detail-tags">
								{visibleTags.map((tag) => (
									<span key={tag} className="guest-tag guest-tag--group">
										{tag}
									</span>
								))}
							</div>
						</div>
					)}
					{item.phone && (
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">Teléfono</span>
							<span className="guest-card__detail-value">{item.phone}</span>
						</div>
					)}
					{item.email && (
						<div className="guest-card__detail">
							<span className="guest-card__detail-label">Email</span>
							<span className="guest-card__detail-value">{item.email}</span>
						</div>
					)}
				</div>

				{/* Zone B: Guest message */}
				{hasMsg && (
					<div className="guest-card__expanded-msg">
						<span className="guest-card__expanded-msg-label">Mensaje del invitado</span>
						<p className="guest-card__expanded-msg-text">{item.guestComment}</p>
					</div>
				)}

				{/* Zone C: Actions */}
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
					<div className="guest-card__chips">
						{hasCompactChips &&
							compactChips.map((chip) => (
								<span key={chip} className="guest-tag guest-tag--group">
									{chip}
								</span>
							))}
						{compactOverflow > 0 && (
							<span className="guest-tag guest-tag--overflow">
								+{compactOverflow}
							</span>
						)}
						{hasMsg && (
							<span className="guest-tag guest-tag--message">Con mensaje</span>
						)}
					</div>
				</div>
				<span className={`status-pill status-pill--${primaryStatus.class}`}>
					<span className="status-pill__dot" />
					{primaryStatus.label}
				</span>
			</header>

			<div className="guest-card__metrics">
				<div className="guest-card__stat">
					<span className="guest-card__stat-label">Asistentes:</span>
					<span className="guest-card__stat-value">
						{item.attendeeCount}
						<span className="guest-card__stat-sep">/</span>
						{item.maxAllowedAttendees}
					</span>
				</div>
			</div>

			<footer className="guest-card__actions">
				<ShareAction
					guest={item}
					inviteUrl={inviteUrl}
					eventTitle={eventTitle}
					shareTemplates={shareTemplates}
					shareDateContext={shareDateContext}
					onShared={async () => onMarkShared(item)}
					onSaveGuest={onSaveGuest}
				/>
				<button
					type="button"
					className={`btn-icon guest-card__menu-btn ${isExpanded ? 'guest-card__menu-btn--open' : ''}`}
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
