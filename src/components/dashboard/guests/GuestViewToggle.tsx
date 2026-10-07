import React from 'react';
import { CardViewGlyph, ListViewGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import type { GuestListView } from '@/components/dashboard/guests/use-guest-list-view';

interface GuestViewToggleProps {
	view: GuestListView;
	onChange: (view: GuestListView) => void;
}

const OPTIONS: { value: GuestListView; label: string; Icon: typeof ListViewGlyph }[] = [
	{ value: 'list', label: 'Lista', Icon: ListViewGlyph },
	{ value: 'cards', label: 'Tarjetas', Icon: CardViewGlyph },
];

const GuestViewToggle: React.FC<GuestViewToggleProps> = ({ view, onChange }) => (
	<div className="guest-view-toggle">
		<span id="guest-view-toggle-label" className="guest-view-toggle__label">
			Ver como
		</span>
		<div
			className="guest-view-toggle__options"
			role="group"
			aria-labelledby="guest-view-toggle-label"
		>
			{OPTIONS.map(({ value, label, Icon }) => {
				const active = view === value;
				return (
					<button
						key={value}
						type="button"
						className={`guest-view-toggle__option${active ? ' guest-view-toggle__option--active' : ''}`}
						aria-pressed={active}
						onClick={() => onChange(value)}
					>
						<Icon size={18} />
						<span>{label}</span>
					</button>
				);
			})}
		</div>
	</div>
);

export default GuestViewToggle;
