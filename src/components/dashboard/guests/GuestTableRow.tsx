import React, { useId, useState } from 'react';
import { MessageIcon } from '@/components/common/icons/ui';
import CopyLinkButton from '@/components/dashboard/guests/CopyLinkButton';
import { ChevronRightGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import GuestMessageHistory from '@/components/dashboard/guests/GuestMessageHistory';
import { GUEST_TABLE_COL_COUNT } from '@/components/dashboard/guests/GuestTable';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import GuestStatusPill from '@/components/dashboard/guests/GuestStatusPill';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getCompactGroupChips,
	getGuestMessageCount,
	getGuestPeopleLabel,
	getGuestPrimaryAction,
	getGuestMessageFallbackTimestamp,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestTableRowProps {
	item: DashboardGuestItem;
	index: number;
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
}

const GuestTableRow: React.FC<GuestTableRowProps> = ({
	item,
	index,
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
}) => {
	const msgId = useId();
	const [msgOpen, setMsgOpen] = useState(false);
	const [reminderModalOpen, setReminderModalOpen] = useState(false);

	const { chips: compactChips, overflow: compactOverflow } = getCompactGroupChips(item, 1);
	const hasCompactChips = compactChips.length > 0;
	const hasMessages = getGuestMessageCount(item.guestComment) > 0;
	const primaryAction = getGuestPrimaryAction(item, reminderMode, isReminderEligible).action;
	const people = getGuestPeopleLabel(item);

	const msgPanel = hasMessages && msgOpen && (
		<tr className="guest-message-row">
			<td colSpan={GUEST_TABLE_COL_COUNT}>
				<div
					className="guest-message-panel"
					id={msgId}
					role="region"
					aria-label="Mensajes del invitado"
				>
					<GuestMessageHistory
						guestComment={item.guestComment}
						fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
					/>
				</div>
			</td>
		</tr>
	);

	// Answered guests get no send step; the copy action stays available for everyone.
	const renderSendAction = () => {
		if (primaryAction === 'send-reminder') {
			return (
				<>
					<button
						type="button"
						className="btn-primary btn--compact guest-row__reminder-btn"
						onClick={() => setReminderModalOpen(true)}
						title="Enviar recordatorio"
						aria-label={`Enviar recordatorio a ${item.fullName}`}
					>
						<MessageIcon size={14} />
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
		if (primaryAction !== 'share') return null;
		return (
			<ShareAction
				guest={item}
				inviteUrl={inviteUrl}
				eventTitle={eventTitle}
				shareTemplates={shareTemplates}
				shareDateContext={shareDateContext}
				onShared={async () => onMarkShared(item)}
				onSaveGuest={onSaveGuest}
			/>
		);
	};

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
							<span className="invitation-number">
								#{String(index + 1).padStart(2, '0')}
							</span>
							<button
								type="button"
								className="guest-info__open"
								onClick={() => onOpenDetails(item)}
							>
								{item.fullName}
							</button>
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
						<span
							className={`guest-info__phone${item.phone ? '' : ' guest-info__phone--missing'}`}
						>
							{item.phone || 'Sin teléfono'}
						</span>
						{hasMessages && (
							<button
								type="button"
								className="guest-nota-btn"
								onClick={() => setMsgOpen((v) => !v)}
								aria-expanded={msgOpen}
								aria-controls={msgId}
							>
								<MessageIcon size={16} aria-hidden="true" />
								<span>{msgOpen ? 'Ocultar mensaje' : 'Ver mensaje'}</span>
							</button>
						)}
					</div>
				</td>
				<td data-label="Estado">
					<GuestStatusPill item={item} />
				</td>
				<td data-label="Personas">
					<div className="guest-people">
						<span className="guest-people__primary">{people.primary}</span>
						{people.secondary && (
							<span className="guest-people__secondary">{people.secondary}</span>
						)}
					</div>
				</td>
				<td data-label="Acciones">
					<div className="guest-row__actions">
						{renderSendAction()}
						<CopyLinkButton
							url={inviteUrl}
							guestName={item.fullName}
							className="btn-secondary btn--compact guest-row__copy-btn"
						/>
					</div>
				</td>
				<td data-label="">
					<button
						type="button"
						className="btn-icon guest-row__menu-btn"
						title="Ver detalles"
						aria-label={`Ver detalles de ${item.fullName}`}
						aria-haspopup="dialog"
						onClick={() => onOpenDetails(item)}
					>
						<ChevronRightGlyph size={18} />
					</button>
				</td>
			</tr>

			{msgPanel}
		</>
	);
};

export default GuestTableRow;
