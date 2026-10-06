import React from 'react';
import GuestPrimaryAction from '@/components/dashboard/guests/GuestPrimaryAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getPrimaryStatus,
	getGuestMessageCount,
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
	reminderMode?: boolean;
	isReminderEligible?: boolean;
	onReminderSent?: (guestId: string) => void;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onSaveGuest?: GuestSaveCallback;
	/** Opens the guest detail screen; the card itself never expands in place. */
	onOpenDetails: (item: DashboardGuestItem) => void;
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
	reminderMode,
	isReminderEligible,
	onReminderSent,
	onMarkShared,
	onSaveGuest,
	onOpenDetails,
}) => {
	const messageCount = getGuestMessageCount(item.guestComment);
	const primaryStatus = getPrimaryStatus(item);
	const articleClass = [
		'guest-card',
		item.deliveryStatus === 'shared' ? 'guest-card--shared' : '',
		isCelebrating || isHighlighted ? 'celebrate-success' : '',
	]
		.join(' ')
		.trim();

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
				<GuestPrimaryAction
					item={item}
					inviteUrl={inviteUrl}
					eventTitle={eventTitle}
					shareTemplates={shareTemplates}
					shareDateContext={shareDateContext}
					reminderMode={reminderMode}
					isReminderEligible={isReminderEligible}
					onReminderSent={onReminderSent}
					onMarkShared={onMarkShared}
					onSaveGuest={onSaveGuest}
				/>
				<button
					type="button"
					className="btn-secondary guest-card__details-btn"
					aria-label={`Ver detalles de ${item.fullName}`}
					onClick={() => onOpenDetails(item)}
				>
					Ver detalles
				</button>
			</footer>
		</article>
	);
};

export default GuestCard;
