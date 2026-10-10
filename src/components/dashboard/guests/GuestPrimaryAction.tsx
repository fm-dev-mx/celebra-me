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
}

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
}) => {
	const [reminderModalOpen, setReminderModalOpen] = useState(false);
	const primaryAction = getGuestPrimaryAction(item, reminderMode, isReminderEligible);

	if (primaryAction.action === 'send-reminder') {
		return (
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
		);
	}

	if (primaryAction.action === 'share') {
		return (
			<ShareAction
				guest={item}
				inviteUrl={inviteUrl}
				eventTitle={eventTitle}
				shareTemplates={shareTemplates}
				shareDateContext={shareDateContext}
				onShared={() => onMarkShared(item)}
				onSaveGuest={onSaveGuest}
			/>
		);
	}

	return null;
};

export default GuestPrimaryAction;
