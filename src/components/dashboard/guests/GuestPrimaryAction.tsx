import React, { useState } from 'react';
import { MessageIcon } from '@/components/common/icons/ui';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getGuestPrimaryAction,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestPrimaryActionProps {
	item: DashboardGuestItem;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	reminderMode?: boolean;
	isReminderEligible?: boolean;
	onReminderSent?: (guestId: string) => void;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onSaveGuest?: GuestSaveCallback;
	/** Reports when the share composer opens or closes. */
	onComposerOpenChange?: (item: DashboardGuestItem, open: boolean) => void;
	/** Card and detail sheet use the full button; the table row uses an outlined one. */
	variant?: 'card' | 'row';
}

const REMINDER_BUTTON = {
	card: {
		className:
			'btn-primary dashboard-guests__share-button guest-card__primary-action--reminder',
		iconClassName: 'share-icon',
		iconSize: 16,
	},
	row: {
		className: 'btn-secondary btn--compact guest-row__reminder-btn',
		iconClassName: undefined,
		iconSize: 14,
	},
} as const;

/**
 * The single next step for a guest: share or remind. Answered guests have no next
 * step; their link stays reachable through the always-visible copy action.
 */
const GuestPrimaryAction: React.FC<GuestPrimaryActionProps> = ({
	item,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	reminderMode,
	isReminderEligible,
	onReminderSent,
	onMarkShared,
	onSaveGuest,
	onComposerOpenChange,
	variant = 'card',
}) => {
	const [reminderModalOpen, setReminderModalOpen] = useState(false);
	const primaryAction = getGuestPrimaryAction(item, reminderMode, isReminderEligible);
	const reminderButton = REMINDER_BUTTON[variant];

	let action: React.ReactNode = null;
	if (primaryAction.action === 'send-reminder') {
		action = (
			<button
				type="button"
				className={reminderButton.className}
				onClick={() => setReminderModalOpen(true)}
				title="Enviar recordatorio"
				aria-label={`Enviar recordatorio a ${item.fullName}`}
			>
				<MessageIcon
					className={reminderButton.iconClassName}
					size={reminderButton.iconSize}
				/>
				<span>Recordar</span>
			</button>
		);
	} else if (primaryAction.action === 'share') {
		action = (
			<ShareAction
				guest={item}
				inviteUrl={inviteUrl}
				eventTitle={eventTitle}
				shareTemplates={shareTemplates}
				shareDateContext={shareDateContext}
				onShared={() => onMarkShared(item)}
				outlined={variant === 'row'}
				onSaveGuest={onSaveGuest}
				onComposerOpenChange={
					onComposerOpenChange && ((open) => onComposerOpenChange(item, open))
				}
			/>
		);
	}

	// The modal lives outside the action branch: onReminderSent fires before the hand-off
	// finishes and can drop the guest from the eligible set, which must not unmount the
	// modal or its manual fallback.
	return (
		<>
			{action}
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
	);
};

export default GuestPrimaryAction;
