import React, { useId, useState } from 'react';
import { MessageIcon } from '@/components/common/icons/ui';
import CopyLinkButton from '@/components/dashboard/guests/CopyLinkButton';
import GuestLastMessage from '@/components/dashboard/guests/GuestLastMessage';
import { GUEST_TABLE_COL_COUNT } from '@/components/dashboard/guests/GuestTable';
import GuestPrimaryAction from '@/components/dashboard/guests/GuestPrimaryAction';
import GuestRowMenu from '@/components/dashboard/guests/GuestRowMenu';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getCompactGroupChips,
	getGuestMessageCount,
	getGuestPeopleLabel,
	getGuestMessageFallbackTimestamp,
	getGuestPrimaryAction,
	getGuestStage,
	type GuestSaveCallback,
	type GuestStage,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestTableRowProps {
	item: DashboardGuestItem;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	/** Row whose details are open in the side panel. */
	isSelected?: boolean;
	reminderMode?: boolean;
	isReminderEligible?: boolean;
	onReminderSent?: (guestId: string) => void;
	onOpenDetails: (item: DashboardGuestItem) => void;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onSaveGuest?: GuestSaveCallback;
	/** Reports when this guest's share composer opens or closes. */
	onComposerOpenChange?: (item: DashboardGuestItem, open: boolean) => void;
}

/** The group header already names the status; only "waiting" needs the finer stage. */
const STAGE_NOTE: Partial<Record<GuestStage, string>> = {
	unopened: 'Enviada, sin abrir',
	opened: 'Abierta, sin responder',
};

type GuestRowVisibleAction = 'next-step' | 'message' | 'copy';

interface GuestRowActionProps extends Pick<
	GuestTableRowProps,
	| 'item'
	| 'inviteUrl'
	| 'eventTitle'
	| 'shareTemplates'
	| 'shareDateContext'
	| 'reminderMode'
	| 'isReminderEligible'
	| 'onReminderSent'
	| 'onMarkShared'
	| 'onSaveGuest'
	| 'onComposerOpenChange'
> {
	action: GuestRowVisibleAction;
	message: { open: boolean; panelId: string; onToggle: () => void };
}

/** The row's single visible action; the rest sits in the «⋯» menu. */
const GuestRowAction: React.FC<GuestRowActionProps> = ({ action, message, ...props }) => (
	<div className="guest-row__actions">
		{action === 'next-step' && <GuestPrimaryAction {...props} variant="row" />}
		{action === 'message' && (
			<button
				type="button"
				className="btn-secondary btn--compact guest-row__message-btn"
				onClick={message.onToggle}
				aria-expanded={message.open}
				aria-controls={message.panelId}
			>
				<MessageIcon size={16} aria-hidden="true" />
				<span>{message.open ? 'Ocultar mensaje' : 'Ver mensaje'}</span>
			</button>
		)}
		{action === 'copy' && (
			<CopyLinkButton
				url={props.inviteUrl}
				guestName={props.item.fullName}
				className="btn-secondary btn--compact guest-row__copy-btn"
			/>
		)}
	</div>
);

const GuestTableRow: React.FC<GuestTableRowProps> = ({
	item,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	celebratingGuestId,
	highlightedGuestId,
	isSelected,
	reminderMode,
	isReminderEligible,
	onReminderSent,
	onOpenDetails,
	onMarkShared,
	onSaveGuest,
	onComposerOpenChange,
}) => {
	const msgId = useId();
	const [msgOpen, setMsgOpen] = useState(false);

	const { chips: compactChips, overflow: compactOverflow } = getCompactGroupChips(item, 1);
	const hasCompactChips = compactChips.length > 0;
	const hasMessages = getGuestMessageCount(item.guestComment) > 0;
	const people = getGuestPeopleLabel(item);
	const stageNote = STAGE_NOTE[getGuestStage(item)];

	// One visible action per row: the next step while unanswered, then the guest's
	// message, then the link. Everything else lives in the «⋯» menu.
	const answered =
		getGuestPrimaryAction(item, reminderMode, isReminderEligible).action === 'copy-link';
	const visibleAction: GuestRowVisibleAction = !answered
		? 'next-step'
		: hasMessages
			? 'message'
			: 'copy';
	const toggleMessage = () => setMsgOpen((v) => !v);

	const msgPanel = hasMessages && msgOpen && (
		<tr className="guest-message-row">
			<td colSpan={GUEST_TABLE_COL_COUNT}>
				<div className="guest-message-panel" id={msgId}>
					<GuestLastMessage
						guestComment={item.guestComment}
						fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
					/>
				</div>
			</td>
		</tr>
	);

	const rowClassName = [
		item.deliveryStatus === 'shared' ? 'row-shared' : '',
		celebratingGuestId === item.guestId ? 'celebrate-success' : '',
		highlightedGuestId === item.guestId ? 'celebrate-success' : '',
		isSelected ? 'guest-row--selected-detail' : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<>
			<tr data-guest-id={item.guestId} className={rowClassName}>
				<td data-label="Invitación">
					<div className="guest-info">
						<span className="guest-info__name">
							<button
								type="button"
								className="guest-info__open"
								onClick={() => onOpenDetails(item)}
							>
								{item.fullName}
							</button>
							{item.isTest && (
								<span className="guest-tag guest-tag--test">Prueba</span>
							)}
							<span className="guest-info__chips">
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
							</span>
						</span>
						<span className="guest-info__meta">
							<span
								className={`guest-info__phone${item.phone ? '' : ' guest-info__phone--missing'}`}
							>
								{item.phone || 'Sin teléfono'}
							</span>
							{stageNote && <span className="guest-info__stage">{stageNote}</span>}
						</span>
					</div>
				</td>
				<td data-label="Personas">
					<div className="guest-people">
						<span className="guest-people__primary">{people.primary}</span>
						{people.secondary && (
							<span className="guest-people__secondary">{people.secondary}</span>
						)}
					</div>
				</td>
				<td data-label="Acción">
					<GuestRowAction
						action={visibleAction}
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
						onComposerOpenChange={onComposerOpenChange}
						message={{ open: msgOpen, panelId: msgId, onToggle: toggleMessage }}
					/>
				</td>
				<td data-label="">
					<GuestRowMenu
						guestName={item.fullName}
						inviteUrl={inviteUrl}
						showCopy={visibleAction !== 'copy'}
						message={
							hasMessages && visibleAction !== 'message'
								? { open: msgOpen, onToggle: toggleMessage }
								: undefined
						}
						onOpenDetails={() => onOpenDetails(item)}
					/>
				</td>
			</tr>

			{msgPanel}
		</>
	);
};

export default GuestTableRow;
