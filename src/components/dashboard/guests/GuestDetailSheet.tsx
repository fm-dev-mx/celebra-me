import React from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import GuestDetailGroups from '@/components/dashboard/guests/GuestDetailGroups';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import { CheckGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import GuestMessageHistory from '@/components/dashboard/guests/GuestMessageHistory';
import GuestPrimaryAction from '@/components/dashboard/guests/GuestPrimaryAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	formatPhoneDisplay,
	getGuestMessageCount,
	getGuestMessageFallbackTimestamp,
	getGuestPrimaryAction,
	getGuestProgressSteps,
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
	isBrandingRemovalEligible?: boolean;
	onToggleBrandingRemoval?: (guestId: string, hideCelebraMeBranding: boolean) => void;
	onSaveGuest?: GuestSaveCallback;
}

const STEP_STATE_LABEL = {
	done: 'Hecho',
	current: 'Ahora',
	upcoming: 'Pendiente',
} as const;

/** Full-screen guest detail for compact screens: progress, next step and all actions. */
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
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
	onSaveGuest,
}) => {
	const steps = getGuestProgressSteps(item);
	const messageCount = getGuestMessageCount(item.guestComment);
	const primaryActionIsCopy =
		getGuestPrimaryAction(item, reminderMode, isReminderEligible).action === 'copy-link';
	const people = `${item.maxAllowedAttendees} ${item.maxAllowedAttendees === 1 ? 'persona invitada' : 'personas invitadas'}`;
	const subtitle = item.phone ? `${people} · ${formatPhoneDisplay(item.phone)}` : people;

	return (
		<ModalShell
			title={item.fullName}
			subtitle={subtitle}
			className="guest-detail-sheet"
			initialFocus="heading"
			onClose={onClose}
		>
			<div className="dashboard-modal__content guest-detail-sheet__body">
				<section
					className="guest-detail-sheet__progress"
					aria-labelledby="guest-progress-title"
				>
					<h4 id="guest-progress-title" className="guest-detail-sheet__section-title">
						En qué va su invitación
					</h4>
					<ol className="guest-progress">
						{steps.map((step, index) => (
							<li
								key={step.label}
								className={`guest-progress__step guest-progress__step--${step.state}`}
							>
								<span className="guest-progress__marker" aria-hidden="true">
									{step.state === 'done' ? <CheckGlyph size={18} /> : index + 1}
								</span>
								<span className="guest-progress__text">
									<span className="guest-progress__label">{step.label}</span>
									{step.note && (
										<span className="guest-progress__note">{step.note}</span>
									)}
								</span>
								<span className="guest-progress__state">
									{STEP_STATE_LABEL[step.state]}
								</span>
							</li>
						))}
					</ol>
				</section>

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

				{messageCount > 0 && (
					<GuestMessageHistory
						guestComment={item.guestComment}
						fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
					/>
				)}

				<GuestDetailGroups item={item} />

				<div className="guest-detail-sheet__actions">
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
		</ModalShell>
	);
};

export default GuestDetailSheet;
