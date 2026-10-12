import React from 'react';
import GuestViewToggle from '@/components/dashboard/guests/GuestViewToggle';
import type { GuestListView } from '@/components/dashboard/guests/use-guest-list-view';

interface GuestListControlsProps {
	hasGuests: boolean;
	selectionMode: boolean;
	view: GuestListView;
	onViewChange: (view: GuestListView) => void;
	/** False under the message wall, where list and card views do not apply. */
	showViewToggle?: boolean;
	onStartSelection: () => void;
	changeNotice: string | null;
	onDismissNotice: () => void;
}

/** Compact-screen controls above the guest list: view, selection entry and live answers. */
const GuestListControls: React.FC<GuestListControlsProps> = ({
	hasGuests,
	selectionMode,
	view,
	onViewChange,
	showViewToggle = true,
	onStartSelection,
	changeNotice,
	onDismissNotice,
}) => (
	<>
		{hasGuests && !selectionMode && (
			<div className="dashboard-guests__view-toggle">
				{showViewToggle && <GuestViewToggle view={view} onChange={onViewChange} />}
				<button type="button" className="guest-select-toggle" onClick={onStartSelection}>
					Seleccionar varios
				</button>
			</div>
		)}

		{changeNotice && (
			<div className="guest-change-notice" role="status">
				<span className="guest-change-notice__text">{changeNotice}</span>
				<button
					type="button"
					className="guest-change-notice__dismiss"
					onClick={onDismissNotice}
				>
					Entendido
				</button>
			</div>
		)}
	</>
);

export default GuestListControls;
