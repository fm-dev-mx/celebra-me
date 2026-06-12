import React, { useState } from 'react';
import { ChevronDownIcon, CopyIcon, CheckIcon, MessageIcon } from '@/components/common/icons/ui';
import GuestDetailGroups from '@/components/dashboard/guests/GuestDetailGroups';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import GuestMessageHistory from '@/components/dashboard/guests/GuestMessageHistory';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import { useClipboard } from '@/hooks/use-clipboard';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getPrimaryStatus,
	getGuestMessageCount,
	getGuestPrimaryAction,
	getGuestMessageFallbackTimestamp,
	formatGuestMetadataRow,
	formatGuestMessageCount,
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
	reminderMode?: boolean;
	isReminderEligible?: boolean;
	onReminderSent?: (guestId: string) => void;
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
	reminderMode,
	isReminderEligible,
	onReminderSent,
	onToggleExpanded,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
	onSaveGuest,
}) => {
	const { copied, copy: copyLink } = useClipboard();
	const [reminderModalOpen, setReminderModalOpen] = useState(false);

	const messageCount = getGuestMessageCount(item.guestComment);
	const primaryStatus = getPrimaryStatus(item);
	const primaryAction = getGuestPrimaryAction(item, reminderMode, isReminderEligible);
	const primaryActionIsCopy = primaryAction.action === 'copy-link';
	const expandId = `guest-details-${item.guestId}`;

	const expandLabel = isExpanded
		? `Ver menos detalles de ${item.fullName}`
		: `Ver más detalles de ${item.fullName}`;
	const articleClass = [
		'guest-card',
		item.deliveryStatus === 'shared' ? 'guest-card--shared' : '',
		isCelebrating || isHighlighted ? 'celebrate-success' : '',
	]
		.join(' ')
		.trim();

	const actionButton =
		primaryAction.action === 'send-reminder' ? (
			<>
				<button
					type="button"
					className="btn-primary dashboard-guests__share-button guest-card__primary-action--reminder"
					onClick={() => setReminderModalOpen(true)}
					title="Enviar recordatorio"
					aria-label={`Enviar recordatorio a ${item.fullName}`}
				>
					<MessageIcon className="share-icon" size={16} />
					<span>Recordar</span>
				</button>
				{reminderModalOpen && (
					<SendInvitationModal
						key={item.guestId}
						guest={item}
						pendingGuests={[]}
						inviteUrl={inviteUrl}
						onClose={() => setReminderModalOpen(false)}
						onSave={onSaveGuest ?? (async () => item)}
						onMarkShared={async () => onMarkShared(item)}
						onReminderSent={onReminderSent}
						templates={shareTemplates}
						shareDateContext={shareDateContext}
						eventTitle={eventTitle}
						mode="single-reminder"
					/>
				)}
			</>
		) : primaryAction.action === 'share' ? (
			<ShareAction
				guest={item}
				inviteUrl={inviteUrl}
				eventTitle={eventTitle}
				shareTemplates={shareTemplates}
				shareDateContext={shareDateContext}
				onShared={() => onMarkShared(item)}
				onSaveGuest={onSaveGuest}
			/>
		) : (
			<button
				type="button"
				className="btn-primary dashboard-guests__share-button"
				onClick={() => copyLink(inviteUrl)}
				title="Copiar enlace de invitación"
				aria-label={`Copiar enlace de invitación de ${item.fullName}`}
			>
				{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
				<span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
			</button>
		);

	return (
		<article className={articleClass} data-guest-id={item.guestId}>
			<header className="guest-card__header">
				<span className="guest-card__name">{item.fullName}</span>
				<span className={`status-pill status-pill--${primaryStatus.class}`}>
					<span className="status-pill__dot" />
					{primaryStatus.label}
				</span>
			</header>

			<div className="guest-card__meta-row">
				<p className="guest-card__meta">
					{formatGuestMetadataRow(
						index + 1,
						item.attendeeCount,
						item.maxAllowedAttendees,
					)}
				</p>
				{messageCount > 0 && (
					<span className="guest-tag guest-tag--message">
						{messageCount === 1 ? 'Mensaje' : formatGuestMessageCount(messageCount)}
					</span>
				)}
			</div>

			<footer className="guest-card__actions">
				{actionButton}
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

			<section
				id={expandId}
				className={`guest-card__expanded ${isExpanded ? 'guest-card__expanded--open' : ''}`}
				role="region"
				aria-label={`Detalles de ${item.fullName}`}
			>
				<div className="guest-card__expanded-inner">
					{messageCount > 0 && (
						<GuestMessageHistory
							guestComment={item.guestComment}
							fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
						/>
					)}
					<GuestDetailGroups item={item} />
					<div className="guest-card__expanded-actions">
						<GuestExpandedActions
							guestName={item.fullName}
							inviteUrl={inviteUrl}
							isShared={item.deliveryStatus === 'shared'}
							hideCopyLink={primaryActionIsCopy}
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
		</article>
	);
};

export default GuestCard;
