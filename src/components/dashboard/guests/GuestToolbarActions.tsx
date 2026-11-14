import React from 'react';
import ToolbarActionsMenu from '@/components/dashboard/guests/ToolbarActionsMenu';
import type { GuestListView } from '@/components/dashboard/guests/use-guest-list-view';

interface GuestToolbarActionsProps {
	hasGuests: boolean;
	/** The message wall replaces the list, so the view switch does not apply. */
	messageWall: boolean;
	selectionMode: boolean;
	listView: GuestListView;
	onListViewChange: (view: GuestListView) => void;
	onCreate: () => void;
	onExport: () => void;
	onImport: () => void;
	onRefresh: () => void;
	onShareMessages: () => void;
	onStartSelection: () => void;
}

/** "Agregar invitado" plus the options menu, shown beside the guest search. */
const GuestToolbarActions: React.FC<GuestToolbarActionsProps> = ({
	hasGuests,
	messageWall,
	selectionMode,
	listView,
	onListViewChange,
	onCreate,
	onExport,
	onImport,
	onRefresh,
	onShareMessages,
	onStartSelection,
}) => (
	<>
		<button
			type="button"
			onClick={onCreate}
			className="btn-primary btn--compact dashboard-guests__toolbar-create"
		>
			Agregar invitado
		</button>
		<ToolbarActionsMenu
			onExport={onExport}
			onImport={onImport}
			onRefresh={onRefresh}
			onShareMessages={onShareMessages}
			view={
				hasGuests && !messageWall
					? { current: listView, onChange: onListViewChange }
					: undefined
			}
			onStartSelection={hasGuests && !selectionMode ? onStartSelection : undefined}
		/>
	</>
);

export default GuestToolbarActions;
