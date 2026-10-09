import React from 'react';
import { PREDEFINED_GUEST_TAGS } from '@/lib/guests/guest-tags';

interface GuestTagChipsProps {
	value: string[];
	onChange: (groups: string[]) => void;
	/** Accessible name of the chip group. */
	label: string;
	disabled?: boolean;
}

/** Multi-select group chips in one row; groups already on the guest stay selectable. */
const GuestTagChips: React.FC<GuestTagChipsProps> = ({ value, onChange, label, disabled }) => {
	const options = [
		...PREDEFINED_GUEST_TAGS,
		...value.filter((tag) => !PREDEFINED_GUEST_TAGS.includes(tag)),
	];

	return (
		<div className="guest-tag-chips" role="group" aria-label={label}>
			{options.map((tag) => {
				const selected = value.includes(tag);
				return (
					<button
						key={tag}
						type="button"
						className={`guest-tag-chips__chip${selected ? ' guest-tag-chips__chip--selected' : ''}`}
						aria-pressed={selected}
						disabled={disabled}
						onClick={() =>
							onChange(selected ? value.filter((t) => t !== tag) : [...value, tag])
						}
					>
						{tag}
					</button>
				);
			})}
		</div>
	);
};

export default GuestTagChips;
