import React from 'react';

interface GuestListControlsProps {
	changeNotice: string | null;
	onDismissNotice: () => void;
	/** Name of the active answer filter, or null when the list is unfiltered. */
	activeFilterLabel?: string | null;
	onClearFilter?: () => void;
}

/**
 * Notices above the guest list: the live-answer notice and the active answer
 * filter. View and selection live in the toolbar "Opciones" menu; the
 * message wall opens from the event summary.
 */
const GuestListControls: React.FC<GuestListControlsProps> = ({
	changeNotice,
	onDismissNotice,
	activeFilterLabel = null,
	onClearFilter,
}) => (
	<>
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
		{activeFilterLabel && (
			<div className="guest-filter-notice" role="status">
				<span className="guest-filter-notice__text">
					Mostrando: <strong>{activeFilterLabel}</strong>
				</span>
				{onClearFilter && (
					<button
						type="button"
						className="guest-filter-notice__clear"
						onClick={onClearFilter}
					>
						Ver todos
					</button>
				)}
			</div>
		)}
	</>
);

export default GuestListControls;
