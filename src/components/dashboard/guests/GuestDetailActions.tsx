import React, { useEffect, useRef, useState } from 'react';
import CopyLinkButton from '@/components/dashboard/guests/CopyLinkButton';
import { EditGlyph, MoreGlyph } from '@/components/dashboard/guests/GuestGlyphs';

interface GuestDetailActionsProps {
	guestName: string;
	inviteUrl: string;
	isShared: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onMarkShared: () => void | Promise<void>;
	onRevertShared?: () => void | Promise<void>;
	/** Present only when the event allows hiding the creator mark. */
	brandingToggle?: { hidden: boolean; onToggle: () => void };
}

interface MenuAction {
	label: string;
	run: () => void | Promise<void>;
	danger?: boolean;
	/** Reversible actions offer "Deshacer" right after running. */
	undo?: { done: string; run: () => void | Promise<void> };
}

const UNDO_WINDOW_MS = 8000;

/** Short-lived "Deshacer" offer for the last reversible action. */
function useUndoOffer() {
	const [offer, setOffer] = useState<{ done: string; run: () => void | Promise<void> } | null>(
		null,
	);
	useEffect(() => {
		if (!offer) return;
		const timer = window.setTimeout(() => setOffer(null), UNDO_WINDOW_MS);
		return () => window.clearTimeout(timer);
	}, [offer]);
	return { offer, setOffer };
}

/**
 * Always-visible action bar of the guest detail: copy and edit up front, the rest
 * (including the destructive delete) behind an explicit "Más acciones" menu.
 */
const GuestDetailActions: React.FC<GuestDetailActionsProps> = ({
	guestName,
	inviteUrl,
	isShared,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
	brandingToggle,
}) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const { offer, setOffer } = useUndoOffer();
	const wrapRef = useRef<HTMLDivElement>(null);
	const menuId = 'guest-detail-more-actions';

	useEffect(() => {
		if (!menuOpen) return;
		const onPointer = (event: PointerEvent) => {
			if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			// Close the menu first; the dialog's own Escape must not fire.
			event.stopPropagation();
			setMenuOpen(false);
		};
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('keydown', onKey, true);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('keydown', onKey, true);
		};
	}, [menuOpen]);

	const actions: MenuAction[] = [];
	if (isShared && onRevertShared) {
		actions.push({
			label: 'Marcar como no enviada',
			run: onRevertShared,
			undo: { done: 'Marcada como no enviada.', run: onMarkShared },
		});
	} else if (!isShared) {
		actions.push({
			label: 'Marcar como enviada',
			run: onMarkShared,
			undo: onRevertShared
				? { done: 'Marcada como enviada.', run: onRevertShared }
				: undefined,
		});
	}
	if (brandingToggle) {
		actions.push({
			label: brandingToggle.hidden
				? 'Mostrar creador en la invitación'
				: 'Ocultar creador en la invitación',
			run: brandingToggle.onToggle,
		});
	}
	actions.push({ label: 'Eliminar invitado…', run: onDelete, danger: true });

	const runAction = async (action: MenuAction) => {
		setMenuOpen(false);
		setOffer(null);
		await action.run();
		if (action.undo) setOffer(action.undo);
	};

	return (
		<>
			<p className="guest-detail-actions__undo" role="status">
				{offer && (
					<>
						<span>{offer.done}</span>
						<button
							type="button"
							className="guest-detail-actions__undo-btn"
							onClick={() => {
								const { run } = offer;
								setOffer(null);
								void run();
							}}
						>
							Deshacer
						</button>
					</>
				)}
			</p>
			<div
				className="guest-detail-actions"
				role="group"
				aria-label={`Acciones para ${guestName}`}
			>
				<CopyLinkButton
					url={inviteUrl}
					guestName={guestName}
					className="guest-detail-actions__btn guest-detail-actions__btn--copy"
				/>
				<button type="button" className="guest-detail-actions__btn" onClick={onEdit}>
					<EditGlyph size={16} />
					<span>Editar</span>
				</button>
				<div className="guest-detail-actions__more" ref={wrapRef}>
					<button
						type="button"
						className="guest-detail-actions__btn guest-detail-actions__btn--icon"
						aria-label="Más acciones"
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						aria-controls={menuOpen ? menuId : undefined}
						onClick={() => setMenuOpen((open) => !open)}
					>
						<MoreGlyph size={20} />
					</button>
					{menuOpen && (
						<div id={menuId} className="guest-detail-actions__menu" role="menu">
							{actions.map((action) => (
								<button
									key={action.label}
									type="button"
									role="menuitem"
									className={`guest-detail-actions__menu-item${action.danger ? ' guest-detail-actions__menu-item--danger' : ''}`}
									onClick={() => void runAction(action)}
								>
									{action.label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default GuestDetailActions;
