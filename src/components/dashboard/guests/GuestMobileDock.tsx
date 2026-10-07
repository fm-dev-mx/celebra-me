import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon } from '@/components/common/icons/ui';
import { MessageGlyph, SentGlyph } from '@/components/dashboard/guests/GuestGlyphs';

interface GuestMobileDockProps {
	loading: boolean;
	hasPendingGenerated: boolean;
	pendingCount?: number;
	hasReminderCta: boolean;
	reminderCount: number;
	createDisabled?: boolean;
	onCreate: () => void;
	onOpenNextAction: () => void;
	onOpenReminder: () => void;
}

/** Visual viewport shrinks well below the layout viewport while the on-screen keyboard is up. */
const KEYBOARD_VIEWPORT_RATIO = 0.75;

function useOnScreenKeyboardOpen(): boolean {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;
		const update = () =>
			setOpen(viewport.height < window.innerHeight * KEYBOARD_VIEWPORT_RATIO);
		viewport.addEventListener('resize', update);
		return () => viewport.removeEventListener('resize', update);
	}, []);
	return open;
}

function pendingAriaLabel(hasPending: boolean, count: number): string {
	if (!hasPending) return 'No hay invitaciones pendientes';
	if (count === 1) return 'Enviar 1 invitación pendiente';
	return count > 1 ? `Enviar ${count} invitaciones pendientes` : 'Enviar invitaciones pendientes';
}

const GuestMobileDock: React.FC<GuestMobileDockProps> = ({
	loading,
	hasPendingGenerated,
	pendingCount = 0,
	hasReminderCta,
	reminderCount,
	createDisabled = false,
	onCreate,
	onOpenNextAction,
	onOpenReminder,
}) => {
	const [isMounted, setIsMounted] = useState(false);
	const keyboardOpen = useOnScreenKeyboardOpen();

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) return null;

	const showReminder = !hasPendingGenerated && hasReminderCta;
	const pendingLabel = pendingCount > 0 ? `Enviar (${pendingCount})` : 'Enviar pendientes';

	return createPortal(
		<div
			className={`dashboard-guests__mobile-dock${keyboardOpen ? ' dashboard-guests__mobile-dock--hidden' : ''}`}
		>
			<button
				type="button"
				className="dock-item"
				onClick={onCreate}
				disabled={createDisabled}
				aria-label="Agregar invitado"
			>
				<span className="dock-icon" aria-hidden="true">
					<PlusIcon size={22} />
				</span>
				<span className="dock-label">Agregar</span>
			</button>

			{showReminder ? (
				<button
					type="button"
					className="dock-item dock-item--main"
					disabled={loading}
					onClick={onOpenReminder}
					aria-label={`Recordar a ${reminderCount} invitados`}
				>
					<span className="dock-icon" aria-hidden="true">
						<MessageGlyph size={22} />
					</span>
					<span className="dock-label">Recordar ({reminderCount})</span>
				</button>
			) : (
				<button
					type="button"
					className="dock-item dock-item--main"
					disabled={loading || !hasPendingGenerated}
					onClick={onOpenNextAction}
					aria-label={pendingAriaLabel(hasPendingGenerated, pendingCount)}
				>
					<span className="dock-icon" aria-hidden="true">
						<SentGlyph size={22} />
					</span>
					<span className="dock-label">
						{hasPendingGenerated ? pendingLabel : 'Sin pendientes'}
					</span>
				</button>
			)}
		</div>,
		document.body,
	);
};

export default GuestMobileDock;
