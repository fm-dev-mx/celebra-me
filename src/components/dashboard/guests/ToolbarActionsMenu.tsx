import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@/components/common/icons/ui';
import { useFloatingMenu } from '@/components/dashboard/guests/use-floating-menu';

interface ToolbarActionsMenuProps {
	onExport: () => void;
	onImport: () => void;
	onRefresh: () => void;
	onShareMessages?: () => void;
}

const ToolbarActionsMenu: React.FC<ToolbarActionsMenuProps> = ({
	onExport,
	onImport,
	onRefresh,
	onShareMessages,
}) => {
	const { open, menuId, triggerRef, menuRef, toggle, close } = useFloatingMenu({
		menuWidth: 200,
		trackVertical: false,
	});

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className={`toolbar-actions-menu__trigger ${open ? 'toolbar-actions-menu__trigger--open' : ''}`}
				onClick={toggle}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls={menuId || undefined}
				aria-label="Más acciones"
				title="Más acciones"
			>
				<span>Más acciones</span>
				<ChevronDownIcon size={14} aria-hidden="true" />
			</button>
			{open &&
				createPortal(
					<div
						ref={menuRef}
						id={menuId}
						className="guest-actions-menu"
						role="menu"
						aria-label="Más acciones"
						onClick={(e) => e.stopPropagation()}
					>
						{onShareMessages && (
							<button
								type="button"
								className="guest-actions-menu__item"
								role="menuitem"
								onClick={() => {
									close();
									onShareMessages();
								}}
							>
								<span>Plantillas de mensaje</span>
							</button>
						)}
						<button
							type="button"
							className="guest-actions-menu__item"
							role="menuitem"
							onClick={() => {
								close();
								onExport();
							}}
						>
							<span>Exportar</span>
						</button>
						<button
							type="button"
							className="guest-actions-menu__item"
							role="menuitem"
							onClick={() => {
								close();
								onImport();
							}}
						>
							<span>Importar</span>
						</button>
						<button
							type="button"
							className="guest-actions-menu__item"
							role="menuitem"
							onClick={() => {
								close();
								onRefresh();
							}}
						>
							<span>Actualizar</span>
						</button>
					</div>,
					document.body,
				)}
		</>
	);
};

export default ToolbarActionsMenu;
