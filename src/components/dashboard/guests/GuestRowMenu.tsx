import React from 'react';
import { createPortal } from 'react-dom';
import { CopyIcon, MessageIcon } from '@/components/common/icons/ui';
import { CopyLinkFallbackDialog } from '@/components/dashboard/guests/CopyLinkButton';
import { ChevronRightGlyph, MoreGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import { useFloatingMenu } from '@/components/dashboard/guests/use-floating-menu';
import { useClipboard } from '@/hooks/use-clipboard';

interface GuestRowMenuProps {
	guestName: string;
	inviteUrl: string;
	/** Omitted when copying is already the row's visible action. */
	showCopy: boolean;
	/** Message toggle; omitted when the guest left none or it is the visible action. */
	message?: { open: boolean; onToggle: () => void };
	onOpenDetails: () => void;
}

/**
 * Secondary row actions behind «⋯», so each table row shows a single visible action.
 * The clipboard state lives here, outside the menu, so the copy feedback and the manual
 * fallback survive the menu closing.
 */
const GuestRowMenu: React.FC<GuestRowMenuProps> = ({
	guestName,
	inviteUrl,
	showCopy,
	message,
	onOpenDetails,
}) => {
	const { open, menuId, triggerRef, menuRef, toggle, close } = useFloatingMenu({
		menuWidth: 200,
	});
	const { status, copy, reset } = useClipboard();

	const run = (action: () => void) => {
		close();
		action();
	};

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className={`btn-icon guest-row__menu-btn${open ? ' guest-row__menu-btn--active' : ''}`}
				onClick={toggle}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls={open ? menuId : undefined}
				aria-label={`Más acciones de ${guestName}`}
				title="Más acciones"
			>
				<MoreGlyph size={20} />
			</button>
			{open &&
				createPortal(
					<div
						ref={menuRef}
						id={menuId}
						className="guest-actions-menu guest-actions-menu--row"
						role="menu"
						aria-label={`Acciones de ${guestName}`}
						onClick={(e) => e.stopPropagation()}
					>
						{showCopy && (
							<button
								type="button"
								className="guest-actions-menu__item"
								role="menuitem"
								onClick={() => run(() => void copy(inviteUrl))}
							>
								<CopyIcon size={16} />
								<span>Copiar enlace</span>
							</button>
						)}
						{message && (
							<button
								type="button"
								className="guest-actions-menu__item"
								role="menuitem"
								onClick={() => run(message.onToggle)}
							>
								<MessageIcon size={16} aria-hidden="true" />
								<span>{message.open ? 'Ocultar mensaje' : 'Ver mensaje'}</span>
							</button>
						)}
						<button
							type="button"
							className="guest-actions-menu__item"
							role="menuitem"
							onClick={() => run(onOpenDetails)}
						>
							<ChevronRightGlyph size={16} />
							<span>Ver detalles</span>
						</button>
					</div>,
					document.body,
				)}
			<span className="sr-only" role="status" aria-live="polite">
				{status === 'copied' ? `Enlace de ${guestName} copiado` : ''}
			</span>
			{status === 'failed' && (
				<CopyLinkFallbackDialog url={inviteUrl} guestName={guestName} onClose={reset} />
			)}
		</>
	);
};

export default GuestRowMenu;
