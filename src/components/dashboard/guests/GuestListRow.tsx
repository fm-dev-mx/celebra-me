import React from 'react';
import { ChevronRightGlyph, MessageGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import CopyLinkButton from '@/components/dashboard/guests/CopyLinkButton';
import {
	getGuestLatestMessage,
	getGuestListSubtitle,
	getGuestStage,
	type GuestStage,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestListRowProps {
	item: DashboardGuestItem;
	inviteUrl: string;
	onOpen: (item: DashboardGuestItem) => void;
}

const STATUS_LABEL: Record<GuestStage, string> = {
	'to-send': 'Por enviar',
	unopened: 'Enviada, sin abrir',
	opened: 'Abierta, sin responder',
	confirmed: 'Confirmado',
	declined: 'No asistirá',
};

/**
 * One-line guest summary for compact screens: tapping the row opens the guest's
 * details. Unanswered rows keep the copy action beside it so it never depends on
 * hover; answered rows drop it (the detail sheet still offers the link).
 */
const GuestListRow: React.FC<GuestListRowProps> = ({ item, inviteUrl, onOpen }) => {
	const stage = getGuestStage(item);
	const bucket = stage === 'unopened' || stage === 'opened' ? 'waiting' : stage;
	const subtitle = getGuestListSubtitle(item);
	const latestMessage = getGuestLatestMessage(item.guestComment);
	const hasMessage = latestMessage.length > 0;
	const answered = stage === 'confirmed' || stage === 'declined';

	return (
		<div className={`guest-row guest-row--${bucket}`}>
			<button
				type="button"
				className="guest-row__open"
				aria-label={`${item.fullName}${item.isTest ? ' (invitado de prueba)' : ''}. ${STATUS_LABEL[stage]}. ${subtitle}${hasMessage ? '. Dejó un mensaje' : ''}`}
				onClick={() => onOpen(item)}
			>
				<span className="guest-row__text" aria-hidden="true">
					<span className="guest-row__name">
						{item.fullName}
						{item.isTest && <span className="guest-tag guest-tag--test">Prueba</span>}
					</span>
					<span className="guest-row__subtitle">{subtitle}</span>
					{hasMessage && (
						<span className="guest-row__message">
							<MessageGlyph size={16} />
							<span className="guest-row__message-text">«{latestMessage}»</span>
						</span>
					)}
				</span>
				<ChevronRightGlyph size={22} className="guest-row__chevron" />
			</button>
			{!answered && (
				<CopyLinkButton
					url={inviteUrl}
					guestName={item.fullName}
					variant="icon"
					className="guest-row__copy"
				/>
			)}
		</div>
	);
};

export default GuestListRow;
