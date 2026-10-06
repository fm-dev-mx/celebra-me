import React from 'react';
import { getGuestListSubtitle } from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestSelectRowProps {
	item: DashboardGuestItem;
	selected: boolean;
	onToggle: (guestId: string) => void;
}

/** Selection-mode row: the whole row is the checkbox label, so any tap toggles it. */
const GuestSelectRow: React.FC<GuestSelectRowProps> = ({ item, selected, onToggle }) => {
	const inputId = `guest-select-${item.guestId}`;
	return (
		<label
			htmlFor={inputId}
			className={`guest-row guest-row--select${selected ? ' guest-row--selected' : ''}`}
		>
			<input
				id={inputId}
				type="checkbox"
				className="guest-row__checkbox"
				checked={selected}
				onChange={() => onToggle(item.guestId)}
			/>
			<span className="guest-row__text">
				<span className="guest-row__name">{item.fullName}</span>
				<span className="guest-row__subtitle">{getGuestListSubtitle(item)}</span>
			</span>
		</label>
	);
};

export default GuestSelectRow;
