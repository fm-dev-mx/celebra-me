import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { CopyIcon, ChevronDownIcon, CheckIcon } from '@/components/common/icons/ui';
import { EditGlyph, DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import { useFloatingMenu } from '@/components/dashboard/guests/use-floating-menu';

interface GuestActionsMenuProps {
	guestName: string;
	inviteUrl: string;
	onEdit: () => void;
	onDelete: () => void;
	onMarkShared: () => Promise<void>;
}

const GuestActionsMenu: React.FC<GuestActionsMenuProps> = ({
	guestName,
	inviteUrl,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const [copied, setCopied] = useState(false);
	const { open, menuId, triggerRef, menuRef, toggle, close } = useFloatingMenu({
		menuWidth: 220,
	});

	const handleCopyLink = useCallback(async () => {
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
			onMarkShared();
		}, 3000);
		close();
	}, [inviteUrl, close, onMarkShared]);

	const handleDelete = useCallback(() => {
		close();
		onDelete();
	}, [close, onDelete]);

	const handleEdit = useCallback(() => {
		close();
		onEdit();
	}, [close, onEdit]);

	const handleMarkShared = useCallback(async () => {
		await onMarkShared();
		close();
	}, [onMarkShared, close]);

	const menuContent = (
		<div
			ref={menuRef}
			id={menuId}
			className="guest-actions-menu"
			role="menu"
			aria-label={`Acciones para ${guestName}`}
			onClick={(e) => e.stopPropagation()}
		>
			<button
				type="button"
				className="guest-actions-menu__item"
				role="menuitem"
				onClick={handleCopyLink}
			>
				{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
				<span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
			</button>
			<button
				type="button"
				className="guest-actions-menu__item"
				role="menuitem"
				onClick={handleMarkShared}
			>
				<CheckIcon size={16} />
				<span>Registrar entrega</span>
			</button>
			<button
				type="button"
				className="guest-actions-menu__item"
				role="menuitem"
				onClick={handleEdit}
			>
				<EditGlyph size={16} />
				<span>Editar</span>
			</button>
			<div className="guest-actions-menu__divider" role="separator" />
			<button
				type="button"
				className="guest-actions-menu__item guest-actions-menu__item--danger"
				role="menuitem"
				onClick={handleDelete}
			>
				<DeleteGlyph size={16} />
				<span>Eliminar</span>
			</button>
		</div>
	);

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className={`guest-actions-menu__trigger ${open ? 'guest-actions-menu__trigger--open' : ''}`}
				onClick={toggle}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls={menuId}
				aria-label={`Más acciones para ${guestName}`}
				title="Más acciones"
			>
				<span>Más</span>
				<ChevronDownIcon size={14} aria-hidden="true" />
			</button>
			{open && createPortal(menuContent, document.body)}
		</>
	);
};

export default GuestActionsMenu;
