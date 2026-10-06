import React from 'react';
import {
	CheckGlyph,
	ChevronRightGlyph,
	ClockGlyph,
	DeclinedGlyph,
	MessageGlyph,
	SentGlyph,
} from '@/components/dashboard/guests/GuestGlyphs';
import {
	getGuestListSubtitle,
	getGuestMessageCount,
	getGuestStatusBucket,
	type GuestStatusBucket,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestListRowProps {
	item: DashboardGuestItem;
	onOpen: (item: DashboardGuestItem) => void;
}

const STATUS_ICON: Record<GuestStatusBucket, typeof ClockGlyph> = {
	'to-send': ClockGlyph,
	waiting: SentGlyph,
	confirmed: CheckGlyph,
	declined: DeclinedGlyph,
};

const STATUS_LABEL: Record<GuestStatusBucket, string> = {
	'to-send': 'Por enviar',
	waiting: 'Esperando respuesta',
	confirmed: 'Confirmado',
	declined: 'No asistirá',
};

/** One-line guest summary for compact screens; tapping it opens the guest's details. */
const GuestListRow: React.FC<GuestListRowProps> = ({ item, onOpen }) => {
	const bucket = getGuestStatusBucket(item);
	const Icon = STATUS_ICON[bucket];
	const subtitle = getGuestListSubtitle(item);
	const hasMessage = getGuestMessageCount(item.guestComment) > 0;

	return (
		<button
			type="button"
			className={`guest-row guest-row--${bucket}`}
			aria-label={`${item.fullName}. ${STATUS_LABEL[bucket]}. ${subtitle}${hasMessage ? '. Dejó un mensaje' : ''}`}
			onClick={() => onOpen(item)}
		>
			<span className="guest-row__status" aria-hidden="true">
				<Icon size={20} />
			</span>
			<span className="guest-row__text" aria-hidden="true">
				<span className="guest-row__name">{item.fullName}</span>
				<span className="guest-row__subtitle">{subtitle}</span>
				{hasMessage && (
					<span className="guest-row__message">
						<MessageGlyph size={16} />
						Dejó un mensaje
					</span>
				)}
			</span>
			<ChevronRightGlyph size={22} className="guest-row__chevron" />
		</button>
	);
};

export default GuestListRow;
