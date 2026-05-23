import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightIcon, PlusIcon } from '@/components/common/icons/ui';

interface GuestMobileDockProps {
	loading: boolean;
	hasPendingGenerated: boolean;
	createDisabled?: boolean;
	onCreate: () => void;
	onOpenNextAction: () => void;
}

const GuestMobileDock: React.FC<GuestMobileDockProps> = ({
	loading,
	hasPendingGenerated,
	createDisabled = false,
	onCreate,
	onOpenNextAction,
}) => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) return null;

	return createPortal(
		<div className="dashboard-guests__mobile-dock">
			<button
				type="button"
				className="dock-item"
				onClick={onCreate}
				disabled={createDisabled}
				aria-label="Agregar nuevo invitado"
			>
				<span className="dock-icon" aria-hidden="true">
					<PlusIcon size={18} />
				</span>
				<span className="dock-label">Agregar</span>
			</button>

			<button
				type="button"
				className="dock-item dock-item--main"
				disabled={loading || !hasPendingGenerated}
				onClick={onOpenNextAction}
				aria-label={
					hasPendingGenerated
						? 'Resolver siguiente invitación'
						: 'No hay invitaciones pendientes'
				}
			>
				<span className="dock-icon" aria-hidden="true">
					<ArrowRightIcon size={18} />
				</span>
				<span className="dock-label">
					{hasPendingGenerated ? 'Enviar pendientes' : 'Sin pendientes'}
				</span>
			</button>
		</div>,
		document.body,
	);
};

export default GuestMobileDock;
