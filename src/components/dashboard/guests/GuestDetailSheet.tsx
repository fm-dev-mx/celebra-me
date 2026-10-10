import React from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import GuestDetailActions from '@/components/dashboard/guests/GuestDetailActions';
import GuestDetailMore from '@/components/dashboard/guests/GuestDetailMore';
import GuestLastMessage from '@/components/dashboard/guests/GuestLastMessage';
import GuestPrimaryAction from '@/components/dashboard/guests/GuestPrimaryAction';
import GuestStatusCard from '@/components/dashboard/guests/GuestStatusCard';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	formatPhoneDisplay,
	getGuestMessageFallbackTimestamp,
	getGuestPrimaryAction,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestDetailSheetProps {
	item: DashboardGuestItem;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	reminderMode?: boolean;
	isReminderEligible?: boolean;
	onReminderSent?: (guestId: string) => void;
	onClose: () => void;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onRevertShared?: (item: DashboardGuestItem) => Promise<void>;
	onUpdateGroups?: (guestId: string, groups: string[]) => Promise<void>;
	isBrandingRemovalEligible?: boolean;
	onToggleBrandingRemoval?: (guestId: string, hideCelebraMeBranding: boolean) => void;
	onSaveGuest?: GuestSaveCallback;
}

/**
 * Guest detail: full screen on phones, a dialog on tablets and a side panel on
 * desktop. Status and next step lead; secondary facts open on demand; the action
 * bar sits in the fixed footer so it never needs scrolling.
 */
const GuestDetailSheet: React.FC<GuestDetailSheetProps> = ({
	item,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	reminderMode,
	isReminderEligible,
	onReminderSent,
	onClose,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
	onUpdateGroups,
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
	onSaveGuest,
}) => {
	const hasNextStep =
		getGuestPrimaryAction(item, reminderMode, isReminderEligible).action !== 'copy-link';
	const passes = `${item.maxAllowedAttendees} ${item.maxAllowedAttendees === 1 ? 'pase' : 'pases'}`;
	const subtitle = `${passes} · ${item.phone ? formatPhoneDisplay(item.phone) : 'Sin teléfono'}`;
	const brandingToggle =
		isBrandingRemovalEligible && onToggleBrandingRemoval
			? {
					hidden: item.hideCelebraMeBranding ?? false,
					onToggle: () =>
						onToggleBrandingRemoval(
							item.guestId,
							!(item.hideCelebraMeBranding ?? false),
						),
				}
			: undefined;

	return (
		<ModalShell
			title={item.fullName}
			subtitle={subtitle}
			className="guest-detail-sheet"
			initialFocus="heading"
			onClose={onClose}
			footer={
				<GuestDetailActions
					guestName={item.fullName}
					inviteUrl={inviteUrl}
					isShared={item.deliveryStatus === 'shared'}
					onEdit={() => onEdit(item)}
					onDelete={() => onDelete(item)}
					onMarkShared={async () => onMarkShared(item)}
					onRevertShared={onRevertShared ? async () => onRevertShared(item) : undefined}
					brandingToggle={brandingToggle}
				/>
			}
		>
			<div className="dashboard-modal__content guest-detail-sheet__body">
				<GuestStatusCard item={item} />

				{hasNextStep && (
					<div className="guest-detail-sheet__primary">
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
					</div>
				)}

				<GuestLastMessage
					guestComment={item.guestComment}
					fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
				/>

				<GuestDetailMore item={item} onUpdateGroups={onUpdateGroups} />
			</div>
		</ModalShell>
	);
};

export default GuestDetailSheet;
