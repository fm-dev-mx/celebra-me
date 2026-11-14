import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@/components/common/icons/ui';
import { MoreGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import { useFloatingMenu } from '@/components/dashboard/guests/use-floating-menu';
import type { GuestListView } from '@/components/dashboard/guests/use-guest-list-view';

interface ToolbarActionsMenuProps {
	onExport: () => void;
	onImport: () => void;
	onRefresh: () => void;
	onShareMessages?: () => void;
	/** Compact screens only: switch between the list and the cards. */
	view?: { current: GuestListView; onChange: (view: GuestListView) => void };
	onStartSelection?: () => void;
	/** Icon-only trigger, for the compact search row. */
	iconOnly?: boolean;
}

interface MenuItem {
	key: string;
	label: string;
	onSelect: () => void;
	/** Hidden on wide screens, where the table has no card view. */
	compactOnly?: boolean;
}

function buildItems({
	onExport,
	onImport,
	onRefresh,
	onShareMessages,
	view,
	onStartSelection,
}: ToolbarActionsMenuProps): MenuItem[] {
	const items: MenuItem[] = [];
	if (view) {
		const next: GuestListView = view.current === 'cards' ? 'list' : 'cards';
		items.push({
			key: 'view',
			label: next === 'cards' ? 'Ver como tarjetas' : 'Ver como lista',
			onSelect: () => view.onChange(next),
			compactOnly: true,
		});
	}
	if (onStartSelection) {
		items.push({ key: 'select', label: 'Seleccionar varios', onSelect: onStartSelection });
	}
	if (onShareMessages) {
		items.push({ key: 'templates', label: 'Plantillas de mensaje', onSelect: onShareMessages });
	}
	items.push(
		{ key: 'export', label: 'Exportar', onSelect: onExport },
		{ key: 'import', label: 'Importar', onSelect: onImport },
		{ key: 'refresh', label: 'Actualizar', onSelect: onRefresh },
	);
	return items;
}

const ToolbarActionsMenu: React.FC<ToolbarActionsMenuProps> = (props) => {
	const { iconOnly = false } = props;
	const { open, menuId, triggerRef, menuRef, toggle, close } = useFloatingMenu({
		menuWidth: 200,
		trackVertical: false,
	});

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className={`toolbar-actions-menu__trigger${iconOnly ? ' toolbar-actions-menu__trigger--icon' : ''}${open ? ' toolbar-actions-menu__trigger--open' : ''}`}
				onClick={toggle}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls={menuId || undefined}
				aria-label={iconOnly ? 'Opciones' : undefined}
				title={iconOnly ? 'Opciones' : undefined}
			>
				{iconOnly ? (
					<MoreGlyph size={20} />
				) : (
					<>
						<span>Opciones</span>
						<ChevronDownIcon size={14} aria-hidden="true" />
					</>
				)}
			</button>
			{open &&
				createPortal(
					<div
						ref={menuRef}
						id={menuId}
						className="guest-actions-menu"
						role="menu"
						aria-label="Opciones"
						onClick={(e) => e.stopPropagation()}
					>
						{buildItems(props).map((item) => (
							<button
								key={item.key}
								type="button"
								className={`guest-actions-menu__item${item.compactOnly ? ' guest-actions-menu__item--compact' : ''}`}
								role="menuitem"
								onClick={() => {
									close();
									item.onSelect();
								}}
							>
								<span>{item.label}</span>
							</button>
						))}
					</div>,
					document.body,
				)}
		</>
	);
};

export default ToolbarActionsMenu;
